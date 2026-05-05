---
spec_id: checkout-hardening
phase: analyze
status: clean
created: 2026-04-30
reviewer_model: gpt-5.1
---

# Analysis — checkout-hardening

Cross-artefact consistency check before implementation. The architect
charter walks `spec.md → clarifications.md → plan.md → tasks.md` looking for
contradictions, missing coverage, and constitution conflicts.

## Findings

| ID | Area | Severity | Note | Resolution |
|----|------|----------|------|------------|
| A-1 | Spec ↔ Plan | info | Spec lists 5 requirements; plan covers each one without ambiguity. | none |
| A-2 | Plan ↔ Tasks | info | Every task maps to at least one requirement. R5 ("must not alter non-auth status codes") is covered implicitly by extracting the helper without touching the 0/non-401/403 branches. | accepted |
| A-3 | Constitution | info | The change satisfies `operations` ("errors actionable to the user") and does not weaken `security` (no new auth surface, no PII change). | none |
| A-4 | Tests | low | Initial tasks.md draft did not include the helper-level assertion. Decision in plan.md was "test at the page level"; tasks accepted as-is. | accepted (page-level test sufficient given the small surface area) |

## Constitution conflicts

None. The introduction of an `auth_required` code is additive; the prior
`api_error` callers continue to receive `api_error` for any non-auth status.

## Risks (residual)

- If a future BFF endpoint returns a 401 from a non-auth cause (e.g. a
  misconfigured upstream), users would be routed to sign-in. The triage
  skill in `.specfleet/skills/triage.md` is enough to catch and reclassify
  that case in a follow-up spec.

## Verdict

**Proceed to implement.** No blockers.
