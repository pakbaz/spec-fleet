# SpecFleet CLI Reference (v0.6)

<!-- markdownlint-disable MD040 MD060 -->

SpecFleet exposes 12 verbs. Everything else (subagent spawning, model
routing, tool gating) happens inside Copilot CLI itself — SpecFleet is a
thin shim.

```text
specfleet <verb> [options]
```

## Workspace verbs

### `init`

Scaffolds `.specfleet/` and `.github/` in the current (or `--dir`) directory.

```bash
specfleet init                              # interactive — prompts for mode
specfleet init --non-interactive            # CI-safe; auto-detects mode
specfleet init --dir ./my-app               # target a different folder
specfleet init --instruction ./corp.md      # override the constitution (regular file only — symlinks rejected)
specfleet init --mode greenfield            # force a mode
specfleet init --from-v5                    # archive v0.5 layout, scaffold v0.6
```

Modes (auto-detected when `--mode` is omitted):

| Mode         | Trigger |
| --- | --- |
| `greenfield` | empty repo, no recognised code markers |
| `brownfield` | code markers present (package.json, pyproject.toml, go.mod, …) |
| `upgrade` | `.specfleet/` already exists |
| `overwrite` | only with `--non-interactive` plus explicit flag |

### `check`

```bash
specfleet check              # validate charters / mirror / Copilot CLI / prompts / MCP
specfleet check --staged     # scan `git diff --cached` for secrets
specfleet check --fix        # re-mirror charters into .github/agents/
```

### `config`

```bash
specfleet config show                      # print active config + paths
specfleet config list                      # enumerate charters / prompts / instructions / mcp
specfleet config set models.review gpt-5.1
specfleet config set defaultMaxContextTokens 80000
```

`set` parses booleans (`true`/`false`), numbers, and JSON values.

### `mcp serve`

```bash
specfleet mcp serve
```

Speaks JSON-RPC 2.0 over stdio. Wire it into your agent host's MCP config
(for Copilot CLI, use `.mcp.json`):

```json
{
  "servers": {
    "specfleet": {
      "command": "specfleet",
      "args": ["mcp", "serve"]
    }
  }
}
```

Tools exposed: `query_charter`, `query_constitution`, `query_project`,
`scratchpad_read`, `scratchpad_append`, `scratchpad_search`,
`scratchpad_archive`. Resources: `specfleet://constitution`,
`specfleet://project`.

---

## Pipeline verbs (Spec-Kit eight)

All eight take `<spec-id>` (kebab-cased; auto-slugified on `specify`) and
the same shared options:

| Option | Purpose |
|---|---|
| `--charter <name>` | Override the default charter for the phase |
| `--model <id>`     | Override the model |
| `--allow-tool <t>` | Repeatable; restricts the tool surface |
| `--non-interactive`| Pass `--no-interactive` to Copilot |

### `specify`

```bash
specfleet specify "todo-api" --description "REST API with JSON storage, CRUD, validation"
```

Seeds `.specfleet/specs/<id>/spec.md` with the frontmatter stub
(`status: draft`).

### `clarify`

```bash
specfleet clarify todo-api --answer "stack: node 20" --answer "db: sqlite"
```

Each `--answer` is appended verbatim to `clarifications.md`.
Status → `clarifying`.

### `plan` (default charter: architect)

```bash
specfleet plan todo-api
```

Writes `plan.md`. Status → `planned`.

### `tasks`

```bash
specfleet tasks todo-api
```

Writes `tasks.md`. Status → `tasked`.

### `analyze` (default charter: architect)

```bash
specfleet analyze todo-api
```

Writes `analysis.md`. Used pre-implement to surface risks.

### `implement` (default charter: dev)

```bash
specfleet implement todo-api --task crud-endpoints
```

`--task` filters to a specific row of `tasks.md`. Output goes into
`scratchpad.md`; status → `implementing`. Implementation summary is
extracted via the `## Summary` heading.

### `review` (default charter: architect, model: review model)

```bash
specfleet review todo-api                  # cross-model (gpt-5.1 by default)
specfleet review todo-api --same-model     # disable cross-model gate
```

Writes `review.md`.

### `checklist` (default charter: compliance)

```bash
specfleet checklist todo-api
```

Writes `checklist.md`. Status → `done`.

---

## Argv shape we send to Copilot

`buildArgv()` is a pure function that produces:

```
copilot -p - [--no-interactive] [--agent <charter>] [--model <id>] [--allow-tool <t>]…
```

The prompt always streams via **stdin** (`-p -`) so we never blow shell
quoting limits. Each dispatch writes a JSONL transcript to
`.specfleet/runs/<run-id>.jsonl` with `start`, `stdout`, `stderr`, and
`exit` events.

## Environment overrides

| Variable | Effect |
|---|---|
| `SPECFLEET_COPILOT_BINARY` | Override the `copilot` binary (testing) |
| `SPECFLEET_REVIEW_MODEL`   | Override `models.review` for one call |
