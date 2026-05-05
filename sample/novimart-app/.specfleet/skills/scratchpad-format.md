# scratchpad-format

The shared scratchpad at `.specfleet/scratchpad/<spec-id>.md` is short-lived,
multi-charter scratch space for a single spec. It uses **exactly four** sections
in this order:

```markdown
# Scratchpad — <spec-id>

## Findings
- _(empirical observations — what's actually true in the codebase or runtime)_

## Decisions
- _(commitments made during a phase — pair each with a one-sentence rationale)_

## Open Questions
- _(things blocking progress — tag the charter that should resolve them)_

## Files Touched
- _(running list, appended by the dev charter during implement)_
```

## Rules

- **Append only via the MCP tool** `scratchpad_append` (or by hand-editing under
  the right heading). Never rewrite history.
- Every appended note is prefixed with `<author> — ` so we can tell which
  charter wrote it.
- When a spec is done, `scratchpad_archive` rotates the file to
  `.specfleet/scratchpad/archive/<YYYY-MM-DDTHH-MM-SSZ>__<spec-id>.md` so it
  survives in git history but doesn't clutter the active list.

## When to use which section

| Section          | Good appends                          | Anti-patterns                                  |
|------------------|---------------------------------------|------------------------------------------------|
| Findings         | "Auth header parsed twice in middleware A and B." | Speculation, restating the spec            |
| Decisions        | "Use `pino` over `winston` (already in deps)."    | Long debates — capture the choice, not the meeting |
| Open Questions   | "Should we cache 401s? — devsecops"   | TODO lists; questions need an owning charter   |
| Files Touched    | `src/auth/middleware.ts` (refactor)   | Imaginary or planned files                     |

## Example interaction

```
> scratchpad_append spec_id=payment-flow section=Decisions \
    author=architect content="Single-region Postgres; cross-region is Phase 2."
```

The dev charter then reads the scratchpad before each task to absorb the latest
findings/decisions without re-running prior phases.
