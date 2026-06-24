# Architecture

SpecFleet is a pure Spec Kit extension. It does not ship a standalone CLI,
package runtime, workflow runner, or MCP server.

## Components

```text
extension.yml
commands/
  charter.md
  scratchpad.md
  review.md
  check.md
specfleet-config.template.yml
tests/unit/extension.test.ts
```

- `extension.yml` declares the extension id (`specfleet`), Spec Kit command
  requirements, provided commands, optional hooks, defaults, and tags.
- `commands/` contains the prompt files registered by Spec Kit as
  `/speckit.specfleet.*` commands.
- `specfleet-config.template.yml` is copied by users into
  `.specify/extensions/specfleet/specfleet-config.yml` for settings.
- `tests/unit/extension.test.ts` validates extension packaging and prevents the
  repository from reintroducing a standalone npm/CLI surface.

## Runtime model

The user's agent host runs all commands. Core lifecycle work stays in Spec Kit:

```text
/speckit.specify -> /speckit.plan -> /speckit.tasks -> /speckit.implement
```

SpecFleet commands augment that lifecycle with governance artifacts:

```text
/speckit.specfleet.charter
/speckit.specfleet.scratchpad
/speckit.specfleet.review
/speckit.specfleet.check
```

No SpecFleet code executes locally; command files instruct the agent how to read
and write feature artifacts.
