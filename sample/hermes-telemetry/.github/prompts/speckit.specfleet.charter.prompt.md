---
description: "Author or refresh a SpecFleet charter — a committed task contract for the active feature."
---

# SpecFleet Charter

You are running the **charter** command of the SpecFleet extension. A charter is a
committed, version-controlled **task contract** (Goal / Inputs / Output / Constraints)
with a single owning **role**. It scopes the work for the active feature and is read by
later phases (plan, tasks, implement, review).

> SpecFleet charters are **not** a lifecycle orchestrator. They augment the core Spec Kit
> phases; they do not chain or replace them.

## User Input

$ARGUMENTS

The argument is an optional role and/or short intent, for example `architect: design the
checkout hardening` or just `dev`. If no role is given, default to `orchestrator`.

## Configuration

Load extension config from `.specify/extensions/specfleet/specfleet-config.yml` if present.
Use `roles` for the list of valid roles and `models.default` for the implementation model.
Valid roles: `orchestrator`, `architect`, `dev`, `test`, `devsecops`, `compliance`, `sre`.

## Steps

1. Determine the **active feature**: the current feature directory under `specs/` (the one
   matching the checked-out feature branch). If none exists, ask the user which feature
   this charter is for and stop.
2. Read context for the feature:
   - `specs/<feature>/spec.md`, and any of `plan.md`, `tasks.md` that already exist.
   - The project constitution under `.specify/memory/` (e.g. `constitution.md`) if present.
3. Pick the **role** from `$ARGUMENTS` (validate against the configured `roles`).
4. Write `specs/<feature>/charter.md` with this exact shape (overwrite if it already exists,
   preserving any human edits under `## Notes`):

```markdown
---
feature: <feature>
role: <role>
status: active
created: <YYYY-MM-DD>
---

# Charter — <feature> (<role>)

## Goal
<1–3 sentences: the single outcome this charter is accountable for.>

## Inputs
- spec.md, plan.md, tasks.md (as available)
- The constitution and project conventions
- <other concrete inputs>

## Output
<The exact artifact(s) or change this charter must produce.>

## Constraints
- Pick the smallest scope that makes progress.
- Stay inside this charter's role; defer out-of-role work to another charter.
- <feature-specific constraints, e.g. compliance scope, performance budgets>

## Notes
- <free-form; safe to hand-edit between runs>
```

## Constraints

- Do **not** invent business context the user did not provide. Capture unknowns under
  `## Notes` rather than guessing.
- One charter per role per feature. If a charter for the requested role already exists,
  refresh it in place — never duplicate.
- Keep the charter under ~80 lines. The charter is a contract, not a design document.
