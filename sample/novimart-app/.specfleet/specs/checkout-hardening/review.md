---
spec_id: checkout-hardening
phase: review
status: approved
created: 2026-04-30
reviewer_model: gpt-5.1
implement_model: claude-sonnet-4.5
---

# Review — checkout-hardening

Cross-model review. The implementation was produced by `claude-sonnet-4.5`;
this review was produced by `gpt-5.1` per `.specfleet/config.json`. Anti-bias
mechanic per ADR-0005.

## Files touched

- [`frontend/src/lib/api/client.ts`](../../../frontend/src/lib/api/client.ts) — added `defaultCodeForStatus(status)`; `normalizeError` now uses it.
- [`frontend/src/features/checkout/CheckoutPage.tsx`](../../../frontend/src/features/checkout/CheckoutPage.tsx) — branched alert on `error.code === 'auth_required'`; added typed `ApiError` import.
- [`frontend/src/features/checkout/__tests__/checkout.test.tsx`](../../../frontend/src/features/checkout/__tests__/checkout.test.tsx) — extended for the 401 path (added in implementation; covered by R4).

## Review against the spec

| Req | Verdict | Evidence |
|-----|---------|----------|
| R1 (envelope distinguishes 401/403/other) | ✅ | `defaultCodeForStatus` returns `auth_required`/`forbidden`/`api_error`. |
| R2 (api client maps 401 → `auth_required`) | ✅ | `normalizeError` falls through to the helper unless body specifies a code. |
| R3 (CheckoutPage shows distinct alert with sign-in link) | ✅ | New `isAuthRequired` branch renders an amber alert with `<a href="/account/sign-in?return=/checkout">`. |
| R4 (unit test asserts alert on 401) | ✅ | New test stubs 401 and asserts `role="alert"` text matches /Sign in to continue/. |
| R5 (no behaviour change for non-auth status) | ✅ | Default `api_error` mapping preserved; test for 500 still passes (regression check). |

## Architect notes (reviewer charter)

- **Style:** matches surrounding code; no new patterns introduced.
- **A11y:** the new alert keeps `role="alert"`. The amber colour pairs with
  amber-700 text → contrast ratio 5.3:1 on white, above WCAG AA 4.5:1 for
  body text.
- **Bundle impact:** +0.2 KB minified for the helper + branch. Within the
  200 KB initial-route budget.
- **Compliance:** no PII, no PCI-relevant change. The redirect target is a
  same-origin path validated server-side.

## Outstanding items

None blocking. The follow-up "resume checkout after sign-in" idea is filed
in `risks` of `spec.md` and is intentionally out of scope here.

## Verdict

**Approved.** Proceed to checklist.
