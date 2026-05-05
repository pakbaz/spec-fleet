---
spec_id: checkout-hardening
phase: plan
status: approved
created: 2026-04-30
---

# Plan — checkout-hardening

## Architecture

- Two surfaces change: the **api client** (`frontend/src/lib/api/client.ts`)
  introduces a `defaultCodeForStatus(status)` helper used by `normalizeError`,
  and the **CheckoutPage** (`frontend/src/features/checkout/CheckoutPage.tsx`)
  branches its alert based on `error.code === 'auth_required'`.
- No backend changes. The BFF already returns HTTP 401 when MSAL tokens
  expire or are missing; `ProblemDetails` body remains unchanged.
- No new dependencies, no new routes.

## Data

- No data model changes. `ApiError.code` is a string union by convention,
  not a closed enum, so adding `auth_required` and `forbidden` requires no
  schema migration.

## Security & Compliance

- The new sign-in link `/account/sign-in?return=/checkout` reuses the
  existing same-origin guard on the SignIn page (no open redirect risk).
- Constitution `operations` invariant satisfied: errors become more
  actionable to the user, not less.
- No PII change. The 401 path never touches order data.

## Operations

- Existing OpenTelemetry trace spans on the api-client request interceptor
  already record `http.response.status_code`. No new metrics needed; an
  existing dashboard panel "checkout-session 4xx breakdown" automatically
  picks up the new mapping by status code.
- Rollback: revert the two file changes; behaviour returns to the prior
  generic toast.

## Decisions

- **Map 403 → `forbidden` but reuse the generic alert.** Admin-perm errors
  are not session-expiry; routing them through sign-in would loop.
- **Do not auto-retry.** Replay-after-auth is a separate spec; here we keep
  the change strictly additive to the error mapping.
- **Test at the page level (vitest + RTL), not just the helper.** The
  contract that matters is "user sees sign-in link", not "helper returns
  string".
