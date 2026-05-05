---
description: Phase 6 — Execute the task list.
tools: ["read", "write", "shell", "task"]
model: ${SPECFLEET_MODEL}
---

# Implement

Spec id `{{spec_id}}`. Workspace root: `{{workspace_root}}`.

## Inputs
- `{{spec_dir}}/spec.md`, `plan.md`, `tasks.md`, `analysis.md`
- `.specfleet/skills/` — call `load-skill <name>` to read a skill on demand

## Constitution
{{constitution}}

## Focus
{{user_input}}

## What to do

1. Read `tasks.md`. Execute every task in order (parallelizable tasks marked `||` may be run together).
2. For each task:
   - Make the smallest change that satisfies its acceptance criteria.
   - Run the project's test/lint commands. Iterate until they pass.
   - Append a one-line note to `.specfleet/scratchpad/{{spec_id}}.md` under `## Files Touched`.
3. When all tasks pass, append a `## Summary` block to your final response in this exact shape:

```markdown
## Summary
- Files touched: <comma-separated list of paths>
- Tests added/updated: <list with the new assertions or "none — bug fix only">
- Verification: <commands run + exit codes>
- Open questions: <unresolved items, or "none">
```

## Constraints
- Do not change project structure or add dependencies the plan didn't specify.
- Never commit secrets, fixtures with real PII, or hard-coded credentials.
- If a task can't be completed because the plan is wrong, stop and write the obstruction to scratchpad section `## Open Questions` — do not paper over with a TODO.
- Match the existing style and idioms in each file you touch.
