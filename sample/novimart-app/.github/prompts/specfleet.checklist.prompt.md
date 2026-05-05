---
description: Phase 8 — Post-implement drift detection (compliance checklist).
tools: ["read", "write"]
model: ${SPECFLEET_MODEL}
---

# Checklist

Spec id `{{spec_id}}`. Workspace root: `{{workspace_root}}`.

Run under the **compliance** charter. Verify every requirement in `spec.md` is realized in the working tree — no shortcuts, no trust, evidence required.

## Inputs
- `{{spec_dir}}/spec.md`, `plan.md`, `tasks.md`, `review.md`
- The current state of the working tree

## Constitution
{{constitution}}

## What to do

Write `{{spec_dir}}/checklist.md`:

```markdown
---
spec_id: {{spec_id}}
phase: checklist
generated: <YYYY-MM-DDTHH:MM:SSZ>
---

# Checklist for {{spec_id}}

| # | Requirement | Status | Evidence | Notes |
|---|-------------|--------|----------|-------|
| 1 | <verbatim from spec.md> | pass / partial / fail | path/to/file.ts:L## or test name | <one line> |
| 2 | ... | ... | ... | ... |

## Constitution controls
| Clause | Realized by | Status |
|--------|-------------|--------|
| <e.g. "no PII in logs"> | path/to/logger.ts | pass |

## Verdict
- Passing:  N
- Partial:  N
- Failing:  N
- Action:   <one sentence — what should the dev/test charter fix?>
```

## Constraints
- Read-only — never edit code.
- Each row needs at least one piece of evidence (file path + line, or test name). "I trust the dev" is not evidence.
- Do not invent requirements that aren't in `spec.md`.
- If any row is `partial` or `fail`, set `Action:` to the smallest follow-up needed so CI or reviewers can block the merge.
