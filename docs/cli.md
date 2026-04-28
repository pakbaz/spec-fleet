# `specfleet` CLI Reference

Complete reference for every `specfleet` command.

## Surface

```
specfleet init                     bootstrap or upgrade .specfleet/
specfleet plan [goal...]           decompose goal into role-agent tasks
specfleet run                      execute the next ready task (or all)
specfleet review                   compliance + architect re-review of pending changes
specfleet status                   active sessions, subagent tasks, gates

specfleet check                    health & quality (doctor + flags)
specfleet log [sessionId]          tail audit events / replay session
specfleet config <sub>             inspect & edit orchestrator + charters + policies + MCP + skills
specfleet spec <sub>               author specs (GSD / Spec-Kit shape)

specfleet mcp serve                stdio MCP server
specfleet sre triage               SARIF + audit → triage report
```

Global flag: `--offline` (or `SPECFLEET_OFFLINE=1`) — air-gap mode; runtime refuses
network-bound tools and MCPs.

---

## Lifecycle commands

### `specfleet init`

Bootstrap or upgrade `.specfleet/` for the current repo. **Detects state and prompts
for the right mode**:

| Detected state | Default action |
|---|---|
| Empty / no `package.json` | Greenfield (no prompt) |
| Code present, no `.specfleet/` | Prompt: `brownfield` / `modify` / cancel |
| `.specfleet/` exists | Prompt: `upgrade` / `overwrite` / cancel |
| Legacy `.eas/` exists | Prompt: migrate into `.specfleet/` / overwrite / cancel |

**Flags:**

| Flag | Description |
|---|---|
| `--mode <m>` | Skip the prompt. Values: `greenfield`, `brownfield`, `modify`, `upgrade`, `overwrite`. |
| `--non-interactive` | Pick the safe default for the detected state (no overwrites). |
| `--force` | Required with `--mode overwrite`. Resets `.specfleet/`. |
| `--no-hooks` | Skip git pre-commit hook installation. |
| `--hooks-only` | Install only the hook; do not touch `.specfleet/`. |
| `--instruction <path>` | Replace sample orchestrator instructions with the given file. |
| `--with-pack <name>` | Bootstrap with a compliance pack (`soc2`, `iso27001`, `hipaa`, `pci-dss`, `gdpr`). |

**Env:** `SPECFLEET_INIT_MODE=<mode>` bypasses the prompt for scripted use.

### `specfleet plan [goal...]`

Orchestrator decomposes a goal into briefs across role agents. Each brief
becomes a task in `.specfleet/plans/`.

| Flag | Description |
|---|---|
| `--from-spec <id>` | Seed the plan from a spec authored with `specfleet spec new`. |

### `specfleet run`

Execute the next ready task (or all of them).

| Flag | Description |
|---|---|
| `--task <id>` | Run a specific task. |
| `--all` | Run every ready task in topological order. |
| `--no-gates` | Skip human approval gates. |

### `specfleet review`

Compliance + Architect re-review of pending changes (current git diff).
Writes a review report under `.specfleet/reviews/<ts>.md` and exits non-zero if
strict gates fail.

### `specfleet status`

Print active sessions, subagent task progress, and any human gates awaiting
approval.

---

## Reflection commands

### `specfleet check`

Single health & quality entrypoint. Default = `doctor` (fast).

| Flag | What it runs |
|---|---|
| *(no flags)* | `doctor` only — fast `.specfleet/` integrity check. |
| `--deep` | `doctor` + full audit chain verification across every session. |
| `--audit` | Audit hash-chain verification only. |
| `--eval` | Run the benchmark suite; append to `.specfleet/eval/scoreboard.jsonl`. |
| `--tune` | Draft advisory charter diffs from scoreboard + audit + decisions. |
| `--staged` | Scan the git staged diff for secrets / IP-guard hits. Pre-commit hook target. |
| `--fix` | Re-mirror charters into `.github/agents/` and re-validate everything. |
| `--offline` | Verify that air-gap mode would hold (no network-bound MCPs). |

### `specfleet log [sessionId]`

Tail audit events when no `sessionId` is given. With a `sessionId`, replay that
session as a redacted timeline.

| Flag | Description |
|---|---|
| `--tail` | Follow new events as they're written (no sessionId). |
| `--since <iso>` | Only events after the given ISO timestamp. |
| `--agent <name>` | Filter to one charter / role. |
| `--from <ts>` | Replay starting at this timestamp (with sessionId). |
| `--limit <n>` | Cap output rows. |

### `specfleet config <subcommand>`

Inspect & edit every piece of agent configuration. Targets resolve as:

| Target spec | Resolves to |
|---|---|
| `orchestrator` (default for show/edit) | `.specfleet/instruction.md` |
| `<name>` | Charter `.specfleet/charters/<name>.charter.md` |
| `policy:<file>` | `.specfleet/policies/<file>.json` |
| `mcp:<file>` | `.specfleet/mcp/<file>.json` |
| `skill:<file>` | `.specfleet/skills/<file>.md` |

| Subcommand | What it does |
|---|---|
| `specfleet config show [target]` | Print the config (default: orchestrator). Redacts secrets. |
| `specfleet config list` | Table of every wired config: kind, name, path, last-modified, warnings. |
| `specfleet config edit [target]` | Open in `$EDITOR`. Re-validates on save; prints `chalk.red` on schema failure and leaves `.bak`. |
| `specfleet config new <kind> <name>` | Scaffold a new artifact. Kinds: `charter`, `policy`, `mcp`, `skill`. |
| `specfleet config validate` | Schema-check everything; exits non-zero on failure. CI-friendly. |
| `specfleet config diff` | Show drift between local configs and the bundled reference templates. |

**Examples:**

```bash
specfleet config show                        # orchestrator instructions
specfleet config show dev                    # the dev charter
specfleet config edit sre                    # edit sre charter in $EDITOR
specfleet config new charter data            # new .specfleet/charters/data.charter.md
specfleet config new policy egress           # new .specfleet/policies/egress.json
specfleet config validate                    # CI gate
specfleet config diff                        # drift after `specfleet init --mode upgrade`
```

`edit` re-mirrors charters to `.github/agents/` on save so VS Code Copilot Chat
sees the new content immediately.

### `specfleet spec <subcommand>`

| Subcommand | What it does |
|---|---|
| `specfleet spec new <name>` | Scaffold a new GSD/Spec-Kit-shaped spec under `.specfleet/specs/`. |
| `specfleet spec list` | List specs with status; feeds `specfleet plan --from-spec`. |

---

## Services

### `specfleet mcp serve`

Stdio MCP server exposing `query_decisions`, `query_charter`, `query_project`,
`query_audit` to any compatible consumer (Copilot CLI, VS Code, Claude Desktop).

### `specfleet sre triage`

Consume SARIF + audit logs and produce a triage report under
`.specfleet/triage/<ts>.md`. Specialized SRE flow.

---

## Migrating from legacy projects

SpecFleet is a new package and command. Existing projects that contain `.eas/`
can migrate state into `.specfleet/` non-destructively:

```bash
specfleet init --mode upgrade
```

The command copies legacy state into `.specfleet/` and leaves `.eas/` in place
for review. After validation, remove `.eas/` from your project.

## Environment variables

| Var | Purpose |
|---|---|
| `SPECFLEET_OFFLINE=1` | Air-gap mode (same as `--offline`). |
| `SPECFLEET_INIT_MODE=<mode>` | Bypass the `specfleet init` prompt; same values as `--mode`. |
| `SPECFLEET_INTERVIEW_JSON=<path>` | Pre-fill the `specfleet init` greenfield interview from JSON. |
| `EDITOR` | Used by `specfleet config edit`. Falls back to `vi`. |
