# SpecFleet artifacts

SpecFleet artifacts are created by Spec Kit extension commands, not by a
standalone `specfleet` CLI.

## Feature directory

Core Spec Kit owns the feature directory under `specs/<feature>/`. SpecFleet
adds governance files beside the core phase artifacts:

```text
specs/<feature>/
  spec.md          # core Spec Kit
  plan.md          # core Spec Kit
  tasks.md         # core Spec Kit
  charter.md       # /speckit.specfleet.charter
  scratchpad.md    # /speckit.specfleet.scratchpad
  review.md        # /speckit.specfleet.review
```

## Commands

- `/speckit.specfleet.charter` creates or refreshes `charter.md`.
- `/speckit.specfleet.scratchpad` creates or appends to `scratchpad.md`.
- `/speckit.specfleet.review` writes a charter-compliance `review.md`.
- `/speckit.specfleet.check` reports integrity issues without modifying files.

Settings are read from `.specify/extensions/specfleet/specfleet-config.yml`.
