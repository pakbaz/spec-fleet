---
spec_id: checkout-hardening
phase: checklist
status: passed
created: 2026-04-30
---

# Checklist — checkout-hardening

Drift / completeness gate. Every requirement from `spec.md` must point at
real evidence in the working tree before the spec is closed.

## Requirements ↔ evidence

- [x] **R1** — envelope distinguishes 401/403/other.
  - `frontend/src/lib/api/client.ts` lines 24–32 (`defaultCodeForStatus`)
  - `frontend/src/lib/api/client.ts` lines 34–43 (`normalizeError` consumes it)
- [x] **R2** — api client maps 401 → `auth_required` when body has no `code`.
  - `frontend/src/lib/api/client.ts` line 27
- [x] **R3** — CheckoutPage renders sign-in alert.
  - `frontend/src/features/checkout/CheckoutPage.tsx` lines 28–32 (`isAuthRequired`)
  - `frontend/src/features/checkout/CheckoutPage.tsx` lines 51–55 (alert markup)
- [x] **R4** — unit test asserts the alert path.
  - `frontend/src/features/checkout/__tests__/checkout.test.tsx` (new "renders sign-in alert on 401" case)
- [x] **R5** — non-auth status codes unchanged.
  - Verified by retained generic-error test in the same file; no diff to the 500/network branches.

## Verification commands run

```text
cd frontend
npx vitest --run                 # 18 tests passed (was 17 before)
npm run lint                     # no warnings introduced
npm run build                    # bundle size 198.4 KB (≤ 200 KB budget)
```

## Constitution invariants

- [x] Operations: errors are observable + actionable (improved).
- [x] Security: no new auth surface; redirect target is same-origin.
- [x] Compliance: no PII, no PCI scope shift.

## Status

**PASSED.** Spec is closed. The scratchpad has been archived to
`.specfleet/scratchpad/archive/checkout-hardening.md`.
