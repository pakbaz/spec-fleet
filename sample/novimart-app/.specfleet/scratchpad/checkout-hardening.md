# Scratchpad — checkout-hardening

Working memory shared across sub-tasks during the implement / review phases.
Archived after `checklist` passed; left in place for the sample so readers
can see what the v0.6 scratchpad mechanic looks like in practice.

## Findings

- `frontend/src/lib/api/client.ts` already had a `normalizeError` helper —
  the cleanest insertion point is a sibling helper consumed from the
  fallback branch. No structural rewrite needed.
- `useMutation().error` is typed `unknown` in TanStack Query v5; the page
  needs an explicit `as ApiError | undefined` to read `.code`. This was
  already done elsewhere in the SPA (account features), so no new pattern.
- `ProblemDetails` from the BFF does not include `code`, only `title` /
  `detail` / `status`. So the api client is the *only* thing setting
  `ApiError.code` on a 401.

## Decisions

- 403 maps to `forbidden` but does **not** route to sign-in.
- The sign-in link uses `?return=/checkout` (existing same-origin guard).
- Test at the page level only; helper is not directly unit-tested.

## Open questions

- _(closed)_ Should we auto-replay the request after sign-in? — deferred
  to a follow-up spec; explicitly out of scope here.

## Files touched

- `frontend/src/lib/api/client.ts`
- `frontend/src/features/checkout/CheckoutPage.tsx`
- `frontend/src/features/checkout/__tests__/checkout.test.tsx`
