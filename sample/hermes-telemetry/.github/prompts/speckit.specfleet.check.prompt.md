---
description: "Validate the charters and scratchpad for the active feature and report integrity problems."
---

# SpecFleet Check

You are running the **check** command of the SpecFleet extension. It is a **read-only**
validator for SpecFleet's own artifacts (charters and the shared scratchpad). It does not
touch code and does not run the core Spec Kit phases.

## User Input

$ARGUMENTS

Optional. May name the feature to check; otherwise check the active feature.

## Configuration

Load extension config from `.specify/extensions/specfleet/specfleet-config.yml` if present.
Use `roles` and `scratchpad_sections` as the source of truth for valid values.

## Steps

1. Determine the **active feature** directory under `specs/`. If none exists, ask and stop.
2. **Charters** — for every `specs/<feature>/charter.md` (or per-role charter):
   - Front matter has `feature`, `role`, `status`, `created`.
   - `role` is one of the configured `roles`.
   - The required sections exist: `## Goal`, `## Inputs`, `## Output`, `## Constraints`.
   - No placeholder text (e.g. `<...>`) remains.
3. **Scratchpad** — for `specs/<feature>/scratchpad.md`:
   - The four sections exist, in order: `Findings`, `Decisions`, `Open Questions`,
     `Files Touched` (matching `scratchpad_sections`).
   - No section was renamed, removed, or reordered.
   - Appended notes are author-prefixed (`<author> — ...`).
4. **Secrets** — flag any obvious credential-shaped strings (API keys, tokens, passwords)
   committed inside charters or the scratchpad.
5. Print a compact report:

```text
SpecFleet check — <feature>
  charter.md ........ OK | <N problems>
  scratchpad.md ..... OK | <N problems>
  secrets ........... clean | <N findings>
Result: PASS | FAIL
```

## Constraints

- **Read-only.** Never modify, re-mirror, or repair files — only report.
- Exit/return `FAIL` if any problem is found, otherwise `PASS`.
- Keep the report under ~30 lines; list concrete file + line for each problem.
