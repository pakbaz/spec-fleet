---
description: "Charter-compliance cross-model review (read-only) of the active feature against its charter and scratchpad."
---

# SpecFleet Review

You are running the **review** command of the SpecFleet extension. This is a **read-only**,
**cross-model** review: it should be run with a *different* model than the one that produced
the implementation. Your job is to judge whether the implementation honours its **charter**
and to surface what the implementer missed — not to rewrite the work.

> This differs from a generic lifecycle review: SpecFleet's review is **charter-aware** — it
> grades the implementation against the committed task contract and the shared scratchpad.

## User Input

$ARGUMENTS

Optional. May name the feature to review; otherwise use the active feature.

## Configuration

Load extension config from `.specify/extensions/specfleet/specfleet-config.yml` if present.
Use `models.review` as the reviewer model and `models.default` as the implementer model.

## Inputs

- `specs/<feature>/charter.md` — the committed task contract (the contract you grade against).
- `specs/<feature>/spec.md`, and any of `plan.md`, `tasks.md` that exist.
- `specs/<feature>/scratchpad.md` — the implementer's running notes.
- The current state of the working tree.

## Steps

1. Determine the **active feature** directory under `specs/`. If none exists, ask and stop.
2. Read the charter, spec, plan, tasks, and scratchpad.
3. Write `specs/<feature>/review.md` with this exact shape:

```markdown
---
feature: <feature>
phase: review
generated: <YYYY-MM-DDTHH:MM:SSZ>
reviewer_model: <name of the model running this review>
implementer_model: <name from config models.default>
---

# Review — <feature>

## Verdict
APPROVE | REQUEST_CHANGES | BLOCK

## Charter compliance
- Goal met: yes | partial | no — <one sentence>
- Output delivered as specified: yes | partial | no — <one sentence>
- Constraints honoured: <list any violated constraint, or "all honoured">

## Findings (sorted by severity)

| # | Severity | Where | Issue | Fix |
|---|----------|-------|-------|-----|
| 1 | blocker  | path/to/file.ts:42 | <what's wrong> | <smallest change to resolve> |
| 2 | major    | ... | ... | ... |
| 3 | minor    | ... | ... | ... |
| 4 | nit      | ... | ... | ... |

## Coverage gaps
- Spec requirements with no test: <Req #>
- Open Questions from scratchpad not resolved: <#>

## Things done well
- <one or two short, honest bullets>
```

## Constraints

- **Read-only.** Do not modify code; fixes are applied by a follow-up `speckit.implement`.
- Cite file paths with line numbers for every finding (`src/foo/bar.ts:128`).
- A `BLOCK` verdict requires at least one `blocker` finding with a concrete fix.
- Grade against the **charter**; out-of-scope improvements go in a `## Out of scope` section,
  not in `Findings`.
