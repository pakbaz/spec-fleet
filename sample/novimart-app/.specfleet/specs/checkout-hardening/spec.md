---
id: checkout-hardening
title: Surface auth-required errors during checkout
status: done
created: 2026-04-30
---

# checkout-hardening

## Goal

When a customer's session expires while they are filling in the checkout form,
the SPA must invite them to re-authenticate (and return them to checkout)
instead of showing a generic "couldn't start checkout — try again" toast. The
fix is small and lives entirely in the BFF→SPA error contract.

## Background

NoviMart customers sign in with Entra External ID. Access tokens have a
60-minute lifetime; refresh happens silently via MSAL. A common failure mode
seen in production logs is: customer browses for ~50 minutes, clicks
**Continue to payment**, the silent refresh races a network blip, and the BFF
returns 401. Today the SPA renders a generic red error and the cart is lost
behind the back button. This violates the constitution's `operations` rule
that "service errors are observable and actionable to the user."

## Requirements

1. The BFF→SPA HTTP error envelope MUST distinguish HTTP 401 (`auth_required`)
   and HTTP 403 (`forbidden`) from all other failures (which keep `api_error`).
2. The api client (`frontend/src/lib/api/client.ts`) MUST set
   `ApiError.code = 'auth_required'` for any 401 response that does not carry
   its own `code` in the body.
3. The CheckoutPage MUST render a distinct, accessible alert when the
   mutation error has `code === 'auth_required'`, containing a sign-in link
   that returns the user to `/checkout` after authentication.
4. A unit test MUST assert that a stubbed 401 response from the
   `/checkout/session` endpoint causes the CheckoutPage to render the
   sign-in alert (not the generic error alert).
5. The change MUST NOT alter the behaviour of any non-auth status code.

## Out of scope

- Automatically replaying the failed request after sign-in (deferred — a
  follow-up spec can add a "resume checkout" cookie-pinned flow).
- Changing the BFF response shape (`ProblemDetails` already carries the
  status; only the SPA-side mapping changes).
- Re-architecting MSAL refresh.

## Risks

- **Risk:** other features may be unintentionally relying on the old
  `code: 'api_error'` for 401. *Mitigation:* repo-wide grep for
  `code === 'api_error'` confirmed only the generic toast uses it.
- **Risk:** the deep-link `?return=/checkout` could be abused for
  open-redirect. *Mitigation:* SignIn page already restricts `return` to
  same-origin paths starting with `/`.
