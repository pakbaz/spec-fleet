# PCI-DSS Policy — NoviMart E-Commerce

> **Project policy file** — applied by `compliance/pci` charter on every review.
> Owner: `compliance@novimart.example`.
> **Scope strategy: REDUCTION.** NoviMart systems are out of CDE scope by
> design. This document defines the boundary and how it is enforced.

## 1. Scope position

| Component | In CDE? | Notes |
|---|---|---|
| Browser → NoviMart SPA | **OUT** | Renders payment-button only; no PAN entry on NoviMart pages |
| NoviMart React SPA | **OUT** | Triggers redirect to provider; never receives PAN/CVV |
| NoviMart .NET API | **OUT** | Receives token + status only; PAN/CVV never in request bodies |
| NoviMart Cosmos DB | **OUT** | Stores `paymentToken`, `last4`, `bin`, `cardBrand` (allowable per Req. 3) |
| NoviMart audit log | **OUT** | Logs token only; never PAN |
| NoviMart App Insights | **OUT** | Request bodies on `/payments` and `/checkout` are dropped (telemetry filter) |
| Payment provider hosted page | **In their CDE** | NoviMart has no access |
| Payment provider tokenisation | **In their CDE** | NoviMart has no access |

This corresponds to **SAQ-A** (merchant outsources all CHD handling, no
electronic storage/processing/transmission of CHD on merchant systems).

## 2. Boundary enforcement (mandatory)

The PCI Reviewer subagent will block any PR that:

1. Adds a field with names matching `/(pan|cardnumber|cvv|cvc|cardholder|track)/i` to any DTO, entity, or container
2. Adds a request body shape on `/payments`, `/checkout/*`, `/account/payment-methods` that includes such a field
3. Removes the telemetry filter rule that drops bodies on `/payments` and `/checkout`
4. Introduces a code path that calls a payment provider's *non-tokenising* API directly from NoviMart code
5. Persists more than `last4`, `bin`, `cardBrand`, `paymentToken`, `expiryYearMonth` for a payment instrument
6. Stores any payment-related field in plain text (must use Cosmos CMK container)

## 3. Forbidden artifacts

```
NEVER in code, logs, queues, caches, fixtures, or test data:
  - Real or test PAN values (16-digit number patterns)
  - CVV / CVC / CV2 values
  - Full magnetic stripe data
  - PIN values
  - Cardholder name from a payment context (separate from billing-name)
```

CI runs a regex+entropy scan on every PR (CodeQL custom query +
`secret-scanning`); any match triggers a CRITICAL gate block.

## 4. Allowed artifacts

NoviMart MAY store and process:
- Payment provider token (opaque)
- BIN (first 6 digits) and last 4 digits for support / fraud signals
- Card brand (visa/mc/amex/etc.) for analytics
- Expiry year + month (for "expiring card" reminders)
- Provider-issued payment status, reference, and timestamp

Stored in container `customers.paymentMethods[]`, encrypted at rest with CMK.

## 5. Cryptography

- TLS 1.2+ on all hops
- Private endpoints to all data services
- CMK from Key Vault on payment-adjacent containers (rotation: annual)

## 6. Access control

- Payment-related routes require an authenticated customer or admin
- Admin role `payments-support` (separate from `catalog-admin`) — PIM-eligible only, no standing access
- Service principal for provider callback validates HMAC signature; no shared secrets

## 7. Logging

- Telemetry filter `dropPaymentBodies` is registered in `NoviMart.Api` startup
- Logs include `paymentToken`, status, customerId, timestamp — never PAN/CVV
- Daily review: 1 reviewer (compliance team) signs the day's payment-event summary

## 8. Stub vs production

The sample uses `NoviMart.Infrastructure.Payments.StubPaymentProvider`,
which simulates the redirect+callback contract deterministically. To move to
production:
1. Replace the stub with a real provider's SDK (Stripe, Adyen, Braintree)
2. Provider's hosted page renders on the provider's domain (verified via CSP + redirect URL)
3. Verify the new provider holds **PCI-DSS Level 1** AOC (Attestation of Compliance)
4. Update `/docs/legal/sub-processors.md`
5. PCI Reviewer subagent re-runs against the diff to confirm no scope expansion

## 9. Breach response

If a token leak is suspected:
1. Rotate provider API keys (Key Vault)
2. Provider invalidates affected tokens server-side
3. No PAN exposure (tokens are useless to attackers without provider auth)
4. 72-hour customer notification only if related personal data was also exposed (GDPR overlap)

## 10. Annual attestation

- SAQ-A questionnaire completed annually with the named acquiring bank
- Penetration test of NoviMart perimeter (not CDE — perimeter as required by SAQ-A v4 r2 evolving criteria)
- Evidence stored in `/docs/legal/pci/`
