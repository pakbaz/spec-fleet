# Copilot instructions

This repository uses **Spec Kit** for lifecycle phases and the **SpecFleet**
extension for governance artifacts. Use core `/speckit.*` commands for specify,
clarify, plan, tasks, analyze, implement, and checklist. Use
`/speckit.specfleet.*` commands for charter, scratchpad, review, and artifact
checks.

## Source of truth

- `specs/<feature>/` or the sample's populated feature artifact directory — core
  spec, plan, tasks, charter, scratchpad, review, and checklist artifacts.
- `.specify/extensions/specfleet/specfleet-config.yml` — SpecFleet settings
  (models, valid roles, scratchpad sections).
- `.github/prompts/speckit.specfleet.*.prompt.md` — registered SpecFleet
  extension prompts when present.

## Workflow

1. Start features with `/speckit.specify`.
2. Add a task contract with `/speckit.specfleet.charter` before planning.
3. Keep decisions/findings current with `/speckit.specfleet.scratchpad`.
4. Run `/speckit.specfleet.review` after implementation with the configured
   review model.
5. Finish with `/speckit.specfleet.check` to validate SpecFleet artifacts.
