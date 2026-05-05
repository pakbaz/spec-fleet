---
description: Phase 4 — Decompose the plan into ordered, testable tasks.
tools: ["read", "write"]
model: ${SPECFLEET_MODEL}
---

# Tasks

Spec id `{{spec_id}}`. Inputs:
- `{{spec_dir}}/spec.md`
- `{{spec_dir}}/plan.md`

## What to do

Write `{{spec_dir}}/tasks.md` in this exact shape:

```markdown
---
spec_id: {{spec_id}}
phase: tasks
generated: <YYYY-MM-DDTHH:MM:SSZ>
---

# Tasks for {{spec_id}}

## Order of operations
T1 → T2 → T3 → … (mention parallelizable tasks with `||`)

## Tasks

### T1 — <title>
- **Charter:** dev | test | devsecops | sre | compliance
- **Inputs:** files / specs / contracts this task reads
- **Output:** files this task writes; tests that must pass
- **Acceptance:** one bullet per Spec requirement this task fulfils, by number (e.g. `Req 2`)
- **Estimate:** S / M / L (relative complexity, not time)

### T2 — ...
```

## Constraints
- Every task must map to at least one Spec requirement; every Spec requirement must be covered by at least one task. Add a `## Coverage` table at the end:

```markdown
## Coverage
| Req # | Task(s) |
|-------|---------|
| 1     | T1, T3  |
| 2     | T2      |
```

- Prefer many small tasks over a few large ones — `L` should be the exception.
- Order tasks so the test charter can verify after each one.
