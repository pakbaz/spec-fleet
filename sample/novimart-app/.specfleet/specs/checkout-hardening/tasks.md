---
spec_id: checkout-hardening
phase: tasks
status: complete
created: 2026-04-30
---

# Tasks — checkout-hardening

Each task is independently testable and ordered to keep the working tree
green at every step.

| # | Task | File(s) | Owner charter | Verify |
|---|---|---|---|---|
| 1 | Extract `defaultCodeForStatus(status)` helper. | `frontend/src/lib/api/client.ts` | dev | `cd frontend && npx vitest --run src/lib/api` |
| 2 | Map 401 → `auth_required`, 403 → `forbidden` in `normalizeError`. | `frontend/src/lib/api/client.ts` | dev | same |
| 3 | Branch the CheckoutPage alert on `error.code === 'auth_required'`. | `frontend/src/features/checkout/CheckoutPage.tsx` | dev | `npx vitest --run src/features/checkout` |
| 4 | Add a sign-in alert with `<a href="/account/sign-in?return=/checkout">` and `role="alert"`. | same as #3 | dev | a11y assertion in test |
| 5 | Extend the existing checkout test to assert the sign-in alert renders on a stubbed 401. | `frontend/src/features/checkout/__tests__/checkout.test.tsx` | test | test passes |
| 6 | Repo-wide grep `code === 'api_error'` to confirm no consumer breaks. | (repo) | architect | zero false-positives |

## Stop conditions

- Backend changes: do **not** edit any file under `backend/`.
- New dependencies: do **not** add any package.
- Out-of-scope retries: do **not** wire up replay-after-auth (separate spec).
