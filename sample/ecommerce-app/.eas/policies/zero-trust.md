# Zero Trust Policy — Acme Retail E-Commerce

> **Project policy file** — applied by `compliance/zero-trust` charter on every review.
> Owner: `secops@acme-retail.example`.

## 1. Principle: Verify explicitly

Every access decision uses **all available signals**:
- Identity (Entra External ID for customers, Entra ID for staff)
- Device posture (Intune compliance for staff)
- Location (geo + IP reputation)
- Behaviour (impossible travel, anomaly detection)
- Resource sensitivity (Restricted/Confidential/Internal/Public)

No trust is granted based on network position alone. There is no "internal
network" privilege.

### Customer identity (Entra External ID)
- MFA optional for shoppers but enforced on `payment-method-add`, `address-change`, `email-change`, `password-change`
- Conditional access blocks risky sign-ins (Microsoft Identity Protection)
- Tokens — short-lived (1h access, 24h refresh), HttpOnly cookies via the BFF (never in `localStorage`)

### Staff identity (Entra ID)
- MFA enforced (FIDO2 preferred)
- PIM (Privileged Identity Management) — JIT activation for any role touching production
- Privileged roles: `prod-deploy`, `prod-data-read`, `payments-support`, `audit-read`, `kv-admin`
- Sign-in risk policies block High-risk attempts; require MFA on Medium

### Workload identity (Managed Identities)
- Container Apps system-assigned MI for all platform calls (Cosmos, Key Vault, Storage, Service Bus)
- No client secrets, no connection strings — banned by EAS hooks and CI scanners
- Pipeline auth — federated credentials (OIDC) from GitHub Actions to Entra; no PAT/SP secrets

## 2. Principle: Use least-privilege access

### RBAC matrix

| Role | Permissions (production) | Activation | Notes |
|---|---|---|---|
| `customer` | own data only (`customerId == self`) | implicit on sign-in | enforced in BFF authorization handler |
| `catalog-admin` | products, categories CRUD | PIM 4h max | no order or customer access |
| `order-admin` | orders read, status updates | PIM 4h max | no PAN visibility |
| `payments-support` | payment-events read | PIM 1h max, ticket-required | tokens only, never PAN |
| `prod-deploy` | Container Apps revision ops | PIM 2h max | no data access |
| `prod-data-read` | Cosmos read-only on personal data | PIM 1h max, two-person approval | redacts on export |
| `kv-admin` | Key Vault management | PIM 2h max, two-person approval | rotates keys |
| `audit-read` | audit log read | always-on | append-only access only |

### API authorisation
- Every endpoint declares `[Authorize]` with explicit scope and policy
- Public endpoints (`/products`, `/categories`) declare `[AllowAnonymous]` with comment
- BFF custom policy `OwnsResource` ensures `customerId` claim matches `{customerId}` route param
- Admin endpoints under `/admin/*` require Entra ID + role + recent MFA (max 1h)

### Data minimisation
- API returns DTOs projected to viewmodel; no entity exposure
- Customer self-export omits internal fields (audit hashes, system metadata)
- Logs redact email beyond domain part

## 3. Principle: Assume breach

### Segmentation
- VNet with subnets: `snet-ingress`, `snet-apps`, `snet-data`, `snet-mgmt`
- NSGs deny by default; explicit allow rules per tier
- Cosmos / Storage / Key Vault / Cache — `publicNetworkAccess = Disabled`, accessed via private endpoints from `snet-data`
- Container Apps Environment — internal-only with Front Door / App Gateway WAF terminating TLS at the perimeter

### Encryption
- All data at rest encrypted (Azure default)
- Restricted-class containers (`customers`, `orders`, `audit`) use **CMK** (Key Vault, RSA 3072)
- TLS 1.2+ minimum on every endpoint; mTLS on internal east-west via Container Apps Dapr or platform features
- Backups encrypted with the same CMK

### Container hardening
- Image — distroless / Alpine Chiseled .NET; non-root user; read-only root FS; `no-new-privileges`
- No package managers in runtime image
- Trivy scan in CI; Cosign signature verified at deploy time
- Resource limits set; HPA based on CPU and queue depth

### Telemetry
- OpenTelemetry traces + metrics + logs to App Insights
- Custom signals: failed-auth rate, anomalous data-export volume, NSG widening
- Defender for Cloud + Sentinel correlation; 24×7 alert rotation
- All operator actions on production are logged to immutable audit log (Storage with versioning + WORM lock)

### Blast radius
- Per-tenant data isolation by partition key; no shared cache scopes
- No subscription-scoped role assignments for service principals
- No `*` permissions in Key Vault access policies (RBAC only, scoped)
- Backups in a separate subscription (cross-subscription private link); RPO 1h, RTO 4h

## 4. Six-pillar control map

| Pillar | Controls |
|---|---|
| Identity | MFA, Conditional Access, PIM, federated CI/CD, MI for workloads |
| Devices | Intune for staff endpoints; PAW for kv-admin / prod-data-read |
| Apps | per-request authz; BFF only; no anonymous data endpoints |
| Data | classification labels, CMK on restricted, private endpoints, DLP on egress |
| Infra | private networking, NSGs, hardened containers, signed images, IaC review |
| Network | segmentation, mTLS east-west, FQDN-allowlisted egress firewall |

## 5. Continuous validation

- Weekly: Defender secure score review
- Monthly: PIM access review (auto-removes unused activations)
- Quarterly: penetration test (external)
- Per release: Zero Trust Reviewer subagent runs on the diff
- Per incident: post-mortem with specific Zero Trust pillar attribution

## 6. Common anti-patterns the reviewer blocks

- Public endpoint added without explicit `[AllowAnonymous]` + comment
- Connection string or client secret in code/IaC/env
- `0.0.0.0/0` ingress on any resource
- Cosmos / Storage / KV `publicNetworkAccess = Enabled`
- Wildcard CORS on authenticated routes
- Subscription-scope role assignments
- Standing admin access (no PIM)
- Logs that include personal data beyond the minimum necessary
