# GDPR Policy — NoviMart E-Commerce

> **Project policy file** — applied by `compliance/gdpr` charter on every review.
> Supersedes the generic guidance in the GDPR charter where this file is more
> specific. Owners: `dpo@novimart.example`.

## 1. Personal data inventory

| Category | Examples | Storage | Lawful basis | Retention |
|---|---|---|---|---|
| Identity | name, email, customerId | Cosmos `customers` | Contract (Art. 6(1)(b)) | 7y after last activity |
| Address | shipping/billing addresses | Cosmos `customers.addresses[]` | Contract | tied to customer |
| Order history | items, totals, shipping events | Cosmos `orders` | Contract; legal obligation (tax) | 7y |
| Cart contents | productIds, quantities | Cosmos `carts` | Legitimate interest | 30d TTL |
| Auth identifiers | Entra External ID `oid` | Cosmos `customers.externalId` | Contract | 7y after last activity |
| Telemetry | request traces, IPs (truncated) | App Insights | Legitimate interest (security) | 90d |
| Marketing prefs | opt-in flags, segments | Cosmos `customers.preferences` | Consent (separable) | until withdrawn |

## 2. Lawful basis matrix

- **Contract** — order placement, account management, fulfilment status
- **Legal obligation** — tax records, anti-fraud retention
- **Legitimate interest** — abuse prevention, fraud detection (balancing test in `/docs/legal/legitimate-interest.md`); analytics on aggregated behaviour
- **Consent** — marketing email, non-essential cookies, personalisation
- **No vital-interest, public-task, or special-category processing** in this project

## 3. Subject rights endpoints (mandatory)

Every personal-data write path MUST be matched by a corresponding read/update/
delete path under `/api/me/*`. The frontend Account UI exposes these.

| Right | Article | Endpoint | Notes |
|---|---|---|---|
| Access | 15 | `GET /api/me/data-export` | Returns ZIP of JSON files: profile, orders, carts, audit |
| Rectification | 16 | `PATCH /api/me/profile` | Audit logged |
| Erasure | 17 | `POST /api/me/erasure-request` | Initiates 30-day workflow; legal-holds checked |
| Restriction | 18 | `POST /api/me/restrict-processing` | Sets a flag respected by all jobs |
| Portability | 20 | `GET /api/me/data-export?format=portable` | Same as Access, machine-readable |
| Object | 21 | `POST /api/me/preferences/marketing` (opt out) | Immediate effect |

Erasure requirements:
- Hard-delete from `customers`, `carts`, `audit` (retain only legal-hold rows with subject pseudonymised)
- Cannot delete `orders` (legal obligation) → pseudonymise customer fields, keep order data
- Telemetry purged on next ingestion cycle (≤ 24 h)

## 4. Cross-border transfers

Customer data is region-pinned at the Cosmos container level via approved
Azure regions:
- EU customers → `westeurope` primary, `northeurope` failover
- NA customers → `eastus2` primary, `westus2` failover

No data transit between EU and NA partitions. Operators with global access
sign DPA addenda; PIM-bound, audit-logged.

## 5. Pseudonymisation

`customerId` is a randomly-generated GUID, not derived from personal data.
Cosmos partition keys use `customerId` (not email or name).
Logs and traces use `customerId` only — no PII in log messages.
The audit log uses `actorId` and `subjectId` (both GUIDs).

## 6. Encryption

- At rest — Cosmos service-managed keys for non-restricted data; **CMK from Key Vault** on `customers`, `orders`, `audit` (restricted classification)
- In transit — TLS 1.2+ on every hop; private endpoints inside Azure (no traversal of public internet)

## 7. Breach detection

- Defender for Cloud + App Insights alerts on:
  - unusual customer-data export volume (anomaly detection)
  - role assignment changes on data tier
  - private endpoint deletion or NSG widening
- 72-hour notification process documented in `/docs/runbooks/breach-notification.md`
- DPO (`dpo@novimart.example`) is the named breach contact

## 8. DPIA

A DPIA is **not** triggered for the MVP scope. It will be revisited if any of
the following are introduced:
- profiling/scoring of customers (AI/ML)
- biometric or special-category data
- large-scale automated decision-making with legal/significant effects
- behavioural advertising integrations

## 9. Sub-processors

Documented in `/docs/legal/sub-processors.md`. Each has a DPA + SCCs where
required. Reviewed quarterly.

## 10. Children

NoviMart is not directed at children under 16. Account creation requires
asserted age ≥ 16 in EU regions. No special-category data of minors stored.
