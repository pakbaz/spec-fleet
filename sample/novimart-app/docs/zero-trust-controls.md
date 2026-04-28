# Zero Trust Controls — NoviMart

> **Scope:** Maps NoviMart's implementation choices to Microsoft's Zero Trust pillars and
> shows where in the codebase or infrastructure each control is enforced. This is the reference
> document for the `compliance/zero-trust` SpecFleet subagent.
>
> Zero Trust principles applied: **Verify explicitly · Use least-privilege access · Assume
> breach.**

---

## 1. Pillar map at a glance

| Pillar | Control summary | Evidence |
|--------|-----------------|----------|
| Identity | Entra ID (admin) + Entra External ID (customer); MFA enforced via Conditional Access; JWT validation on every API call | `NoviMart.Infrastructure/Auth/*` |
| Endpoint | Browsers only (no native client); SPA served over HTTPS via SWA; CSP + HSTS headers | `frontend/index.html`, SWA platform default + `staticwebapp.config.json` |
| Application | API authorization gates (`RequireCustomer`, `RequireAdmin`, `OwnsResource`); typed contracts; antiforgery on state-changing routes | `NoviMart.Infrastructure/Auth/AuthPolicies.cs`, `Program.cs` |
| Data | AES-256 at rest, TLS 1.2+ in transit; PII redaction in logs; localStorage stripped of PII; payment data never stored | `pci-scope-boundary.md`, `gdpr-data-flows.md`, `frontend/src/features/cart/useCartPersistence.ts` |
| Infrastructure | Container App ingress HTTPS-only; Cosmos `publicNetworkAccess=Disabled` + private endpoint; Key Vault RBAC + purge-protection | `infra/modules/*.bicep` |
| Network | Private endpoints for Cosmos & Key Vault; SWA → Container App via public HTTPS with origin allowlist; no SSH/RDP exposed | `infra/modules/network.bicep` |
| Visibility | OTel traces → App Insights; Serilog → Log Analytics; SpecFleet audit log → file → LA in prod; alerts on anomalous auth failures | `Program.cs`, `.specfleet/audit/` |
| Automation | SpecFleet subagents enforce policies on every diff; `azd` hooks gate provisioning; CI runs `specfleet review --strict` | `.specfleet/charters/`, `.github/workflows/security.yml` |

---

## 2. Verify explicitly — identity & device

### 2.1 Token validation

Every protected API endpoint is gated by JWT bearer validation. Two authentication schemes are
registered, **not merged**, so a customer token cannot accidentally grant admin scope:

```csharp
// Program.cs (excerpt)
builder.Services
    .AddCustomerAuth(builder.Configuration)   // scheme: "Customer", CIAM authority
    .AddAdminAuth(builder.Configuration);     // scheme: "Admin", workforce authority
```

The `OwnsResource` policy further verifies that the `customerId` route value matches the
`oid` (or `sub`) claim of the presented token; without this, any signed-in customer could
read any other customer's cart.

```csharp
// AuthPolicies.cs (excerpt)
public sealed class OwnsResourceHandler : AuthorizationHandler<OwnsResourceRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        OwnsResourceRequirement requirement)
    {
        var http = (context.Resource as HttpContext)
                   ?? (context.Resource as DefaultHttpContext);
        if (http is null) return Task.CompletedTask;

        var routeId = http.Request.RouteValues["customerId"]?.ToString();
        var claimId = context.User.FindFirst("oid")?.Value
                      ?? context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (!string.IsNullOrEmpty(routeId)
            && string.Equals(routeId, claimId, StringComparison.OrdinalIgnoreCase))
        {
            context.Succeed(requirement);
        }
        return Task.CompletedTask;
    }
}
```

### 2.2 Device & posture (workforce)

Workforce admin access is fronted by Entra ID Conditional Access. Recommended baseline (the
sample assumes a tenant admin has set this up — it is **not** in the Bicep):

- MFA required for all admin accounts (no exceptions).
- Compliant device required (Intune-managed).
- Sign-in risk = High → block; Medium → MFA challenge.
- Session lifetime ≤ 8 h for admin endpoints.

The SpecFleet `compliance/zero-trust.charter.md` records this as a **prerequisite** for any prod
promotion; the deploy gate verifies an admin role assignment exists but cannot itself enforce
CA policies.

---

## 3. Least-privilege access — authorization

### 3.1 RBAC at the data plane

Cosmos and Key Vault are accessed via **managed identity only** — there are no connection
strings, no SAS tokens, no master keys stored anywhere:

```bicep
// infra/modules/cosmos.bicep (excerpt)
resource cosmosRole 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-08-15' = {
  parent: cosmos
  name: guid(cosmos.id, apiIdentity.id, 'data-contributor')
  properties: {
    roleDefinitionId: '${cosmos.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002'  // Data Contributor (built-in)
    principalId: apiIdentity.properties.principalId
    scope: cosmos.id
  }
}
```

Container scope is the **account**, not subscription. Assignment is to the API's
user-assigned identity only — no humans are listed; admins use `az cosmosdb sql role
assignment create` ad-hoc when investigating production data.

Key Vault uses RBAC mode (`enableRbacAuthorization: true`); the API has `Key Vault Secrets
User`, never `Secrets Officer`. The deployment principal does **not** retain a key vault role
after `azd up` completes — the SpecFleet post-provision hook removes `Secrets Officer` from the
deployer once the bootstrap is done.

### 3.2 RBAC at the API

Authorization policies, not roles, gate every endpoint:

| Route | Policy | Rationale |
|-------|--------|-----------|
| `GET /api/v1/products` | (anonymous) | Browse without sign-in |
| `GET /api/v1/categories` | (anonymous) | Browse without sign-in |
| `GET /api/v1/customers/{id}/cart/**` | `OwnsResource` | Customer can only read their own cart |
| `POST /api/v1/orders` | `RequireCustomer` + `OwnsResource` | Sign-in required, ownership enforced |
| `POST /api/v1/admin/products` | `RequireAdmin` | Only admins can mutate the catalog |
| `GET /healthz/**` | (anonymous) | Standard health endpoints |

The SpecFleet `compliance/zero-trust` subagent runs an **endpoint coverage audit** during
`specfleet review`: it walks every route registration in `Program.cs` and asserts that every
non-`/healthz/**`, non-anonymous endpoint has a policy. Violations fail CI.

### 3.3 Just-in-time elevation

For incident response, ops staff request `Cosmos DB Built-in Data Contributor` via PIM with
ticket-based approval; the role grant has a **maximum 4 h lifetime** and is logged. The audit
log dashboard in App Insights surfaces these grants.

---

## 4. Assume breach — defence in depth

### 4.1 Network segmentation

```
Internet ─▶ [Static Web App] ─▶ [Container App ingress] ─▶ [Cosmos via Private Endpoint]
                                          │
                                          └─▶ [Key Vault via Private Endpoint]
```

- Container Apps: ingress = `external`, but with origin allowlist (CORS) restricted to the SWA
  hostname.
- Cosmos: `publicNetworkAccess: Disabled`, accessible **only** via private endpoint in the
  Container Apps subnet.
- Key Vault: same model; bypass = `AzureServices` only.
- No SSH, no RDP, no public DB ports anywhere.

### 4.2 Egress control

The Container Apps environment has **outbound type = managed**. Outbound traffic to:

- Cosmos / Key Vault → private link (no Internet egress)
- App Insights → public endpoint, but data is OTel-instrumented (no PII)
- Payment provider → public HTTPS, payload tokenised (no PAN)

In a production hardening pass, replace with **NAT Gateway + outbound rules** to a fixed IP and
allowlist that IP at the payment provider.

### 4.3 Secrets

| Secret type | Where | How accessed |
|-------------|-------|--------------|
| Cosmos data plane | n/a — managed identity | Token from IMDS, swapped for AAD token, used as `Authorization` header |
| App Insights connection string | Container App env var (not secret material) | OTel SDK |
| Customer auth keys (JWT verification) | n/a — fetched from Entra OIDC metadata | Cached in-process, refreshed every 24h |
| Payment provider API key | Key Vault → mounted as env var via Container App secret reference | App reads on startup |

The `compliance/zero-trust` subagent's `onPreToolUse` hook **rejects any string** that matches
common secret regexes from being written to source files (entropy + pattern checks). The
secondary scanner runs on every commit in `security.yml`.

### 4.4 Logging & monitoring

- **OpenTelemetry** spans every request from SPA fetch → API → Cosmos call. The trace ID is
  surfaced in error responses (RFC 7807 `ProblemDetails.Extensions["traceId"]`) for support.
- **Serilog → App Insights** with PII redaction (see `gdpr-data-flows.md` § 4.2).
- **Audit log**: every SpecFleet tool invocation, every gate approval, every rule violation is
  written as JSONL to `.specfleet/audit/` and shipped to Log Analytics by the production deploy.
- **Alerts** (configured via `infra/modules/monitor.bicep`):
  - `requests | where resultCode startswith "5" | summarize count() | where count_ > 10`
    (5-min sliding window) → email on-call
  - `traces | where customDimensions.audit_event == "policy_violation"` → email security
  - `customEvents | where name == "auth.failed" | summarize count() by client_IP | where count_ > 50`
    → security alert (brute force candidate)

### 4.5 Recovery

- **Cosmos Backup**: continuous (point-in-time restore enabled, 7-day window).
- **Key Vault**: soft-delete + 90-day purge protection (cannot be disabled in prod).
- **Static Web App**: source of truth is the Git repo + `dist/` artefacts; rebuild from CI in
  < 5 min.
- **Container App**: revision history, instant rollback (`az containerapp revision activate`).

---

## 5. Browser-side controls

### 5.1 Headers

The Static Web App ships these via `staticwebapp.config.json`:

```json
{
  "globalHeaders": {
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.azurecontainerapps.io https://*.ciamlogin.com; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
  }
}
```

The `frame-ancestors 'none'` is the modern equivalent of `X-Frame-Options: DENY`.

### 5.2 Token handling

MSAL.js stores tokens in the `sessionStorage` cache (per app default); refresh tokens are
**not** exposed to JavaScript — Entra issues a short-lived access token and a refresh handle
that is HTTP-only-cookie-based (CIAM single-page app flow with auth code + PKCE).

### 5.3 Local storage hygiene

`useCartPersistence.ts` writes only `{ version, items[].{itemId, productId, quantity} }`. No
PII, no payment data, no tokens. The Drawer test suite has a regression test asserting this.

---

## 6. Supply chain

| Risk | Control |
|------|---------|
| Compromised npm package | `npm audit` + Dependabot; CI runs `npm ci --audit-level=high` |
| Compromised NuGet package | NuGet audit (`NuGetAudit=true`); CI runs `dotnet list package --vulnerable --include-transitive` |
| Tampered container base image | API uses `mcr.microsoft.com/dotnet/aspnet:10.0` — Microsoft-signed; multi-stage build; image signature verified by Container Apps via Trivy in CI |
| Source code tamper | Branch protection on `main`; required reviews; CODEOWNERS protects `.specfleet/instruction.md` |
| Workflow tamper | All `actions/*` pinned to commit SHAs (not floating `@v4`) |

CodeQL runs on every PR (`security.yml`) for both `csharp` and `javascript` languages.

---

## 7. SpecFleet subagent enforcement summary

The `compliance/zero-trust.charter.md` ties everything above to actionable hooks:

| Stage | Check |
|-------|-------|
| `onPreToolUse` (write) | Reject patterns matching common secrets (AKIA…, eyJ…, ghp_…) |
| `onPreToolUse` (write) | Reject regression of TLS / HTTPS settings (`requireHttps: false`, `allowInsecure: true`) |
| `onPostToolUse` (write) | Re-run `specfleet config validate` with full charter set |
| `specfleet review --scope=code` | Endpoint coverage audit (every non-anonymous route has a policy) |
| `specfleet review --scope=infra` | Bicep diff: no `publicNetworkAccess: Enabled`, no `enabledForDeployment: true`, no SAS-token usage |
| `specfleet review --scope=deploy` | Verify runtime resource posture (the deploy walkthrough §5 list) |
| `azd preprovision` hook | Run all of the above with `--strict` (warnings = fail) |

Any failure is a **hard gate** — orchestrator pauses, audit entry written, human approval
required to override (which is itself logged with reason).

---

## 8. References

- [Microsoft Zero Trust guidance](https://learn.microsoft.com/security/zero-trust/)
- [Azure Well-Architected — Security pillar](https://learn.microsoft.com/azure/well-architected/security/)
- [OWASP ASVS v4](https://owasp.org/www-project-application-security-verification-standard/)
- NoviMart policy file: `.specfleet/policies/zero-trust.md`
- Related sample docs: `architecture.md`, `pci-scope-boundary.md`, `gdpr-data-flows.md`
