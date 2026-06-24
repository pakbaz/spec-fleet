---
description: "Initialize or append to the four-section shared scratchpad working memory for the active feature."
---

# SpecFleet Scratchpad

You are running the **scratchpad** command of the SpecFleet extension. The scratchpad is a
short-lived, **shared working memory** for a single feature. Multiple charters read and
append to it so that later phases absorb earlier findings without re-running prior work.

The scratchpad uses **exactly four** sections, in this order: **Findings**, **Decisions**,
**Open Questions**, **Files Touched**.

## User Input

$ARGUMENTS

Arguments are optional. They may be:
- empty — initialize the scratchpad for the active feature, or print its current state; or
- `section=<Findings|Decisions|Open Questions|Files Touched> author=<role> content="<text>"`
  — append a single note under the named section.

## Configuration

Load extension config from `.specify/extensions/specfleet/specfleet-config.yml` if present.
Use `scratchpad_sections` to confirm the four section names.

## Steps

1. Determine the **active feature** directory under `specs/` (matching the feature branch).
   If none exists, ask which feature and stop.
2. Ensure `specs/<feature>/scratchpad.md` exists. If it does not, create it with this shape:

```markdown
# Scratchpad — <feature>

## Findings
- _(empirical observations — what's actually true in the codebase or runtime)_

## Decisions
- _(commitments made during a phase — pair each with a one-sentence rationale)_

## Open Questions
- _(things blocking progress — tag the charter/role that should resolve them)_

## Files Touched
- _(running list, appended by the dev charter during implement)_
```

3. If `$ARGUMENTS` contains a `section=`/`content=` append request, add a single bullet
   under the named section. Prefix every appended note with `<author> — ` so it is clear
   which charter/role wrote it. **Append only — never rewrite or delete prior notes.**
4. Print the updated scratchpad path and the affected section.

## Section guidance

| Section        | Good appends                                      | Anti-patterns                          |
|----------------|---------------------------------------------------|----------------------------------------|
| Findings       | "Auth header parsed twice in middleware A and B." | Speculation, restating the spec        |
| Decisions      | "Use `pino` over `winston` (already in deps)."    | Long debates — capture the choice      |
| Open Questions | "Should we cache 401s? — devsecops"               | TODO lists; each question needs an owner|
| Files Touched  | `src/auth/middleware.ts` (refactor)               | Imaginary or planned files             |

## Constraints

- Keep the four sections and their order exactly. Do not add or rename sections.
- Never rewrite history; the scratchpad is append-only working memory.
- When the feature is complete, leave the scratchpad in place — it survives in git history.
