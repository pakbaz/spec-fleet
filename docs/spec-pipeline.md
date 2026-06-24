# Spec Kit pipeline with SpecFleet

SpecFleet no longer provides a separate `specfleet` lifecycle CLI. The lifecycle
is owned by core Spec Kit commands, and SpecFleet contributes extension commands
and optional hooks around those phases.

## Core lifecycle

Run the normal Spec Kit phases in your agent:

```text
/speckit.specify "todo-api"
/speckit.clarify
/speckit.plan
/speckit.tasks
/speckit.analyze
/speckit.implement
/speckit.checklist
```

## SpecFleet layer

Add SpecFleet where governance helps:

```text
/speckit.specfleet.charter architect
/speckit.specfleet.scratchpad
/speckit.specfleet.review
/speckit.specfleet.check
```

The extension writes its artifacts next to the core Spec Kit artifacts under
`specs/<feature>/`:

```text
specs/<feature>/
  spec.md
  plan.md
  tasks.md
  charter.md
  scratchpad.md
  review.md
```

## Hooks

`extension.yml` wires three optional prompts:

| Hook | Command | Purpose |
| --- | --- | --- |
| `before_plan` | `speckit.specfleet.charter` | Capture a task contract before planning |
| `after_tasks` | `speckit.specfleet.scratchpad` | Open shared working memory after task breakdown |
| `after_implement` | `speckit.specfleet.review` | Run charter-aware review after implementation |

## Settings

Settings live in `.specify/extensions/specfleet/specfleet-config.yml`, matching
Spec Kit extension conventions and the community `fleet` extension pattern.
Use it for model choices, valid charter roles, and scratchpad section names.
