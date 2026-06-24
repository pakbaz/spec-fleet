---
feature: checkout-hardening
role: architect
status: active
created: 2026-05-05
---

# Charter — checkout-hardening (architect)

## Goal
Make checkout resilient to expired/invalid sessions: a 401 from the BFF must surface a
sign-in prompt that returns the shopper to `/checkout`, never a generic error toast.

## Inputs
- `specs/checkout-hardening/spec.md`, `plan.md`, `tasks.md`
- The NoviMart constitution (`.specfleet/instruction.md`) and project cheat sheet
- Existing SPA error handling in `frontend/src/lib/api/client.ts`

## Output
A reviewed design and task breakdown that confines the change to the SPA error-mapping
layer plus one page-level test — no BFF contract changes.

## Constraints
- Smallest scope that makes progress; reuse the existing `normalizeError` helper.
- 403 maps to `forbidden` and must **not** route to sign-in.
- Stay in the architect role: hand implementation to the dev charter.

## Notes
- Auto-replaying the request after sign-in is explicitly deferred to a follow-up feature.
