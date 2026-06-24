---
spec_id: checkout-hardening
phase: clarify
status: resolved
created: 2026-04-30
---

# Clarifications — checkout-hardening

The `specify` phase flagged three open questions. Answers below were confirmed
by the product lead and platform tech lead, then folded into `plan.md`.

## Q1. Which status codes count as "auth-class"?

**Decision:** 401 only triggers the sign-in alert. 403 maps to a new
`forbidden` code but keeps the generic alert (a customer who has signed in
but lacks permission for an admin action should not be re-routed through
sign-in). All other 4xx/5xx remain `api_error`.

## Q2. Where does the sign-in link point?

**Decision:** `/account/sign-in?return=/checkout`. Existing SignIn page
already validates that `return` is a same-origin absolute path. No new code
needed there.

## Q3. Should we also clear the cart on auth failure?

**Decision:** No. The cart lives server-side under `/customers/{id}/cart`
keyed by the customer GUID; the client copy is read-only state. After
sign-in the cart will reload automatically.

## Confirmed assumptions

- The BFF already returns 401 (not 500) when a token is invalid or expired.
  Verified in `backend/src/NoviMart.Infrastructure/Auth/JwtBearerExtensions.cs`.
- `ApiError.code` is unset on 401 responses today (the BFF's `ProblemDetails`
  body does not include a `code` field). The api client default is the only
  source of `code`, so the mapping change is sufficient.
- The error type returned by `useMutation().error` is `ApiError`, not
  `Error`. The CheckoutPage already type-asserts this elsewhere.
