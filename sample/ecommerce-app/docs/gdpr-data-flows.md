# GDPR Data Flows — Acme Retail

> **Scope:** This document describes how personal data flows through the Acme Retail e-commerce
> sample, what legal basis applies, and how data subject rights (DSRs) are honoured. It is the
> reference document for the `compliance/gdpr` EAS subagent.
>
> **Status:** Sample / template. **Not** a substitute for legal review by a qualified DPO before
> any real-world deployment.

---

## 1. Personal data inventory

| # | Data category | Examples | Storage | Encryption | Retention |
|---|---------------|----------|---------|-----------|-----------|
| 1 | Account identifiers | `customerId` (GUID), Entra `oid`, email | Cosmos `customers`, Entra External ID | AES-256 at rest (Cosmos), TLS 1.2+ in transit | Account lifetime + 30 days post-deletion |
| 2 | Profile data | display name, locale, marketing opt-in | Cosmos `customers` | AES-256 / TLS 1.2+ | Account lifetime |
| 3 | Shipping address | name, street, city, postcode, country | Cosmos `customers.addresses[]` | AES-256 / TLS 1.2+ | 7 years (tax law) after last order |
| 4 | Order history | order id, line items, totals, ship-to | Cosmos `orders` | AES-256 / TLS 1.2+ | 7 years (tax) |
| 5 | Cart contents (server) | productId, quantity | Cosmos `carts` | AES-256 / TLS 1.2+ | 90 days idle → soft-delete |
| 6 | Cart contents (browser) | productId, quantity, version | localStorage `acme.cart.v1` | Browser-managed | Until user clears or signs in |
| 7 | Telemetry | url path, status code, latency | App Insights | AES-256 (Microsoft-managed) | 90 days |
| 8 | Audit log | actor, action, target, timestamp | `.eas/audit/` (file) → Log Analytics in prod | AES-256 / TLS 1.2+ | 1 year |
| 9 | Payment (PAN, CVV, expiry) | — | **Never stored** (third-party processor only) | n/a | n/a |

> 🚨 Item #9 is the PCI scope boundary. See `pci-scope-boundary.md` for the full enforcement
> story. The EAS `compliance/pci` subagent reviews every diff against this rule.

---

## 2. Data flow diagrams (textual)

### 2.1 Anonymous browse (no PII)

```
[Browser]  ──HTTPS──▶  [Static Web App]  ──HTTPS──▶  [Container App API]
                                                          │
                                                          ▼
                                                    [Cosmos: products]
                                                    (no personal data)
```

No personal data is collected. App Insights records URL path + status only (request IP is
truncated to /24 by an `ITelemetryProcessor` — see `Acme.Retail.Infrastructure/Logging/
PiiRedactingTelemetryProcessor.cs`).

### 2.2 Sign-in (Entra External ID)

```
[Browser]  ──MSAL.js──▶  [Entra External ID tenant]  (no Acme database involved)
                                  │
                                  ▼
                         id_token, access_token   ──▶ Browser stores in
                                                       MSAL session cache
```

Acme **never** sees the password. Entra External ID is the identity provider of record;
profile attributes (email, displayName) are returned in the `id_token`.

### 2.3 Add to cart (signed-in)

```
[Browser]  ──HTTPS + Bearer──▶  [Container App API]
                                       │ (JWT validation against CIAM authority)
                                       │ (OwnsResource policy: customerId in route == oid claim)
                                       ▼
                                 [Cosmos: carts] (PK = /customerId)
                                 stores productId + quantity only
```

The cart record has **no name, no address, no payment data**. The customer GUID is the
partition key; deleting the partition deletes the cart in O(1).

### 2.4 Place order (checkout, stubbed)

```
[Browser]  ──HTTPS──▶  [API: POST /orders]
                              │
                              ├──▶ [Cosmos: orders]  (line items, totals, shipping addr, customerId)
                              │
                              └──▶ [PaymentProvider stub]  ──would call──▶  [Adyen / Stripe / Worldpay]
                                                                            (out of PCI scope for Acme)
```

The real provider returns a tokenised reference (`paymentToken`) which is stored on the order;
no PAN ever touches Acme infrastructure. See `pci-scope-boundary.md`.

### 2.5 Telemetry & audit

```
[API]  ──OTel──▶  [Application Insights]   ──ARM──▶  [Log Analytics workspace]
                              │                              ▲
                              │                              │
                              └─ structured logs ────────────┘

[EAS runtime]  ──JSONL──▶  .eas/audit/<date>_<session>.jsonl  ──in CI──▶  Log Analytics
                              │
                              └─ secret-scanned + PII-redacted before write
```

---

## 3. Legal basis (per Article 6 GDPR)

| Activity | Legal basis | Notes |
|----------|------------|-------|
| Account creation, login | **Contract** (Art. 6(1)(b)) | Necessary to provide the service |
| Order processing, shipping | **Contract** | Includes sharing address with carrier |
| Tax-record retention (7 yrs) | **Legal obligation** (Art. 6(1)(c)) | Local tax law (varies per market) |
| Marketing emails | **Consent** (Art. 6(1)(a)) | Opt-in stored in `customers.marketingConsent`, version + timestamp |
| Telemetry / fraud prevention | **Legitimate interests** (Art. 6(1)(f)) | LIA documented in `.eas/policies/gdpr.md` |
| Audit log | **Legal obligation / legitimate interests** | Required for incident response & accountability |

---

## 4. Data subject rights (DSR) — implementation

| Right | Endpoint | Implementation | SLA |
|-------|----------|----------------|-----|
| **Access (Art. 15)** | `GET /api/v1/customers/{id}/profile/export` | Aggregates data from `customers`, `orders`, `carts` and returns JSON; gated by `OwnsResource` policy | < 30 days |
| **Rectification (Art. 16)** | `PATCH /api/v1/customers/{id}/profile` | Updates allowed fields; immutable fields (id, oid) rejected with 400 | Immediate |
| **Erasure (Art. 17)** | `POST /api/v1/customers/{id}/profile/forget-me` | Soft-deletes within 24 h; hard-purge after retention windows expire (orders kept anonymized for tax) | < 30 days |
| **Restriction (Art. 18)** | `POST /api/v1/customers/{id}/profile/restrict` | Sets `processingRestricted=true`; APIs reject all writes except DSR endpoints | Immediate |
| **Portability (Art. 20)** | Same export endpoint, JSON format documented | Format documented in OpenAPI spec, machine-readable | < 30 days |
| **Object (Art. 21)** | `POST /api/v1/customers/{id}/profile/marketing/opt-out` | Toggles consent record + writes audit entry | Immediate |
| **Withdraw consent** | Same as Object | Audit entry includes prior consent version + timestamp | Immediate |

These endpoints are implemented in the **production** version of Acme Retail; the sample
includes the contracts and a stub controller in `Acme.Retail.Api/Endpoints/DsrEndpoint.cs`
(commented out as TODO; the EAS `compliance/gdpr` subagent flags the missing implementation in
`eas doctor`).

### 4.1 Erasure flow (detailed)

```
1. Customer triggers POST /forget-me (with re-auth challenge for high-risk action).
2. API writes a tombstone document `customers.<id>.deletionRequest` and emits
   `customer.erasure.requested` event to Service Bus (out of sample scope).
3. Background worker processes the request:
   a. Anonymise `customers.<id>` (replace name/email with sentinel, blank addresses).
   b. Remove `customerId` from `carts` partition (entire partition deleted).
   c. Anonymise orders: keep order_id, line items, totals (tax law), null out shipping.
   d. Tell Entra External ID to revoke the user's account.
   e. Append audit entry with the deletion timestamp + retention reason for kept data.
4. Customer receives confirmation email + a JSON "what was deleted / what was kept" report.
```

The 24-hour SLA is enforced by an alert in App Insights:
`requests | where url endswith "forget-me" | join (events | where name == "customer.erased")`

### 4.2 PII redaction in logs (defence in depth)

`Acme.Retail.Infrastructure/Logging/PiiRedactingEnricher.cs` (referenced by `Program.cs` via
`.Enrich.WithForbiddenFieldRedaction()`) strips known PII fields from log records *before*
they are written. The **block list** is configuration-driven (so Compliance can extend it
without redeploying code):

```jsonc
{
  "Logging": {
    "ForbiddenFields": [
      "email", "Email", "EmailAddress",
      "addressLine1", "AddressLine1",
      "phone", "Phone", "PhoneNumber",
      "pan", "cardNumber", "cvv", "CVV", "expiry"
    ]
  }
}
```

Any field with these names — at any depth in the structured log object — is replaced by
`"[REDACTED]"`. The `compliance/gdpr` subagent has a unit test that asserts this enricher
participates in the pipeline; tampering with that registration fails CI.

---

## 5. Cross-border transfers

| Source | Destination | Mechanism | Notes |
|--------|-------------|-----------|-------|
| EU customer browser | EU Cosmos region (West Europe in prod) | Geo-routed via Front Door | Sample is single-region; production must geo-route |
| EU customer | Microsoft Azure Telemetry (App Insights) | EU-resident workspace | Configured via `AZURE_LOCATION` for Log Analytics |
| EU customer | Payment processor | Standard Contractual Clauses | Per processor's DPA |

For the sample (single-region eastus2), the `compliance/gdpr` subagent emits an `INFO` finding
that documents this is acceptable for non-prod only.

---

## 6. Vendor / sub-processor list

| Vendor | Service | Data shared | DPA in place |
|--------|---------|-------------|--------------|
| Microsoft Azure | Hosting (Container Apps, Cosmos, Key Vault, App Insights, SWA) | Items 1-8 above | Yes (Microsoft Online Services Terms) |
| Microsoft Entra External ID | Identity | Items 1-2 | Yes (Microsoft Online Services Terms) |
| Stripe (or equivalent) | Payment processing | Item 9 (PAN, CVV) and tokenised refs returned | Stripe DPA |
| GitHub (Actions) | CI/CD | Source code only | GitHub Customer Agreement |

The EAS `compliance/gdpr.charter.md` requires this table to be kept current; PRs that add
package references to known SaaS SDKs (Sendgrid, Twilio, Stripe, etc.) trigger a charter
finding to update this list.

---

## 7. Breach notification

The audit log + App Insights provide the evidentiary trail. On detection of an unauthorised
access:

1. SRE on-call invokes the runbook in `.eas/policies/gdpr.md` § "Breach response".
2. EAS captures a forensic snapshot of audit logs from the affected window.
3. DPO determines whether a breach meets the Art. 33 / 34 thresholds.
4. If yes, regulator notification within **72 hours**; affected data subjects within
   "without undue delay" if high risk.

---

## 8. EAS subagent enforcement summary

The `compliance/gdpr` subagent (`.eas/charters/subagents/compliance/gdpr.charter.md`) enforces
the contents of this document via the following hooks:

| Hook | What it checks |
|------|----------------|
| `onPreToolUse` (write) | Block writes to `customers.*.email` / `customers.*.address*` outside of allowed code paths |
| `onPostToolUse` (write) | Re-scan the changed file for forbidden field names being **added** to log calls |
| `onSessionStart` | Verify `Logging.ForbiddenFields` list is intact |
| `eas review --scope=code` | Run `dotnet test --filter Category=Gdpr` (PII redactor regression tests) |
| `eas review --scope=deploy` | Verify Cosmos region matches the customer's stated jurisdiction (sample skips) |

Any failure here is a **hard gate** — the orchestrator pauses and a human must review.

---

## 9. References

- Regulation (EU) 2016/679 (GDPR), full text: <https://eur-lex.europa.eu/eli/reg/2016/679/oj>
- ICO guidance (UK): <https://ico.org.uk/for-organisations/guide-to-data-protection/>
- Microsoft GDPR resources: <https://learn.microsoft.com/compliance/regulatory/gdpr>
- Acme Retail policy file: `.eas/policies/gdpr.md`
