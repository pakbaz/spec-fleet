# `eas` CLI Reference (v0.3)

Complete reference for every `eas` command in v0.3. For migration from v0.2,
see the table at the bottom.

## Surface

```
eas init                     bootstrap or upgrade .eas/
eas plan [goal...]           decompose goal into role-agent tasks
eas run                      execute the next ready task (or all)
eas review                   compliance + architect re-review of pending changes
eas status                   active sessions, subagent tasks, gates

eas check                    health & quality (doctor + flags)
eas log [sessionId]          tail audit events / replay session
eas config <sub>             inspect & edit orchestrator + charters + policies + MCP + skills
eas spec <sub>               author specs (GSD / Spec-Kit shape)

eas mcp serve                stdio MCP server
eas sre triage               SARIF + audit → triage report
```

Global flag: `--offline` (or `EAS_OFFLINE=1`) — air-gap mode; runtime refuses
network-bound tools and MCPs.

Global env: `EAS_NO_DEPRECATION_WARN=1` — suppress deprecation warnings from
v0.2 aliases.

---

## Lifecycle commands

### `eas init`

Bootstrap or upgrade `.eas/` for the current repo. **Detects state and prompts
for the right mode**:

| Detected state | Default action |
|---|---|
| Empty / no `package.json` | Greenfield (no prompt) |
| Code present, no `.eas/` | Prompt: `brownfield` / `modify` / cancel |
| `.eas/` exists | Prompt: `upgrade` / `overwrite` / cancel |

**Flags:**

| Flag | Description |
|---|---|
| `--mode <m>` | Skip the prompt. Values: `greenfield`, `brownfield`, `modify`, `upgrade`, `overwrite`. |
| `--non-interactive` | Pick the safe default for the detected state (no overwrites). |
| `--force` | Required with `--mode overwrite`. Resets `.eas/`. |
| `--no-hooks` | Skip git pre-commit hook installation. |
| `--hooks-only` | Install only the hook; do not touch `.eas/`. |
| `--instruction <path>` | Replace sample orchestrator instructions with the given file. |
| `--with-pack <name>` | Bootstrap with a compliance pack (`soc2`, `iso27001`, `hipaa`, `pci-dss`, `gdpr`). |

**Env:** `EAS_INIT_MODE=<mode>` bypasses the prompt for scripted use.

### `eas plan [goal...]`

Orchestrator decomposes a goal into briefs across role agents. Each brief
becomes a task in `.eas/plans/`.

| Flag | Description |
|---|---|
| `--from-spec <id>` | Seed the plan from a spec authored with `eas spec new`. |

### `eas run`

Execute the next ready task (or all of them). Replaces `eas implement`.

| Flag | Description |
|---|---|
| `--task <id>` | Run a specific task. |
| `--all` | Run every ready task in topological order. |
| `--no-gates` | Skip human approval gates. |

### `eas review`

Compliance + Architect re-review of pending changes (current git diff).
Writes a review report under `.eas/reviews/<ts>.md` and exits non-zero if
strict gates fail.

### `eas status`

Print active sessions, subagent task progress, and any human gates awaiting
approval.

---

## Reflection commands

### `eas check`

Single health & quality entrypoint. Default = `doctor` (fast).

| Flag | What it runs |
|---|---|
| *(no flags)* | `doctor` only — fast `.eas/` integrity check. |
| `--deep` | `doctor` + full audit chain verification across every session. |
| `--audit` | `audit verify` only. Same as old `eas audit verify`. |
| `--eval` | Run the benchmark suite; append to `.eas/eval/scoreboard.jsonl`. |
| `--tune` | Draft advisory charter diffs from scoreboard + audit + decisions. |
| `--staged` | Scan the git staged diff for secrets / IP-guard hits. Pre-commit hook target. |
| `--fix` | Re-mirror charters into `.github/agents/` and re-validate everything. |
| `--offline` | Verify that air-gap mode would hold (no network-bound MCPs). |

### `eas log [sessionId]`

Tail audit events when no `sessionId` is given. With a `sessionId`, replay that
session as a redacted timeline.

| Flag | Description |
|---|---|
| `--tail` | Follow new events as they're written (no sessionId). |
| `--since <iso>` | Only events after the given ISO timestamp. |
| `--agent <name>` | Filter to one charter / role. |
| `--from <ts>` | Replay starting at this timestamp (with sessionId). |
| `--limit <n>` | Cap output rows. |

### `eas config <subcommand>`

Inspect & edit every piece of agent configuration. Targets resolve as:

| Target spec | Resolves to |
|---|---|
| `orchestrator` (default for show/edit) | `.eas/instruction.md` |
| `<name>` | Charter `.eas/charters/<name>.charter.md` |
| `policy:<file>` | `.eas/policies/<file>.json` |
| `mcp:<file>` | `.eas/mcp/<file>.json` |
| `skill:<file>` | `.eas/skills/<file>.md` |

| Subcommand | What it does |
|---|---|
| `eas config show [target]` | Print the config (default: orchestrator). Redacts secrets. |
| `eas config list` | Table of every wired config: kind, name, path, last-modified, warnings. |
| `eas config edit [target]` | Open in `$EDITOR`. Re-validates on save; prints `chalk.red` on schema failure and leaves `.bak`. |
| `eas config new <kind> <name>` | Scaffold a new artifact. Kinds: `charter`, `policy`, `mcp`, `skill`. |
| `eas config validate` | Schema-check everything; exits non-zero on failure. CI-friendly. |
| `eas config diff` | Show drift between local configs and the bundled reference templates. |

**Examples:**

```bash
eas config show                        # orchestrator instructions
eas config show dev                    # the dev charter
eas config edit sre                    # edit sre charter in $EDITOR
eas config new charter data            # new .eas/charters/data.charter.md
eas config new policy egress           # new .eas/policies/egress.json
eas config validate                    # CI gate
eas config diff                        # drift after `eas init --mode upgrade`
```

`edit` re-mirrors charters to `.github/agents/` on save so VS Code Copilot Chat
sees the new content immediately.

### `eas spec <subcommand>`

| Subcommand | What it does |
|---|---|
| `eas spec new <name>` | Scaffold a new GSD/Spec-Kit-shaped spec under `.eas/specs/`. |
| `eas spec list` | List specs with status; feeds `eas plan --from-spec`. |

---

## Services

### `eas mcp serve`

Stdio MCP server exposing `query_decisions`, `query_charter`, `query_project`,
`query_audit` to any compatible consumer (Copilot CLI, VS Code, Claude Desktop).

### `eas sre triage`

Consume SARIF + audit logs and produce a triage report under
`.eas/triage/<ts>.md`. Specialized SRE flow.

---

## Migrating from v0.2

Aliases continue to work in v0.3 with a yellow deprecation warning. They are
**removed in v0.4**.

| v0.2 | v0.3 |
|---|---|
| `eas onboard` | `eas init --mode brownfield` |
| `eas implement` | `eas run` |
| `eas doctor` | `eas check` |
| `eas audit tail` | `eas log` |
| `eas audit verify` | `eas check --audit` |
| `eas replay <id>` | `eas log <id>` |
| `eas eval` | `eas check --eval` |
| `eas tune` | `eas check --tune` |
| `eas precommit-scan` | `eas check --staged` *(also kept as the internal hook target)* |
| `eas install-hooks` | `eas init --hooks-only` |
| `eas charter new` | `eas config new charter <name>` |
| `eas charter list` | `eas config list` |
| `eas charter validate` | `eas config validate` |

Suppress the deprecation warning in CI / scripted use:

```bash
EAS_NO_DEPRECATION_WARN=1 eas implement --all
```

## Environment variables

| Var | Purpose |
|---|---|
| `EAS_OFFLINE=1` | Air-gap mode (same as `--offline`). |
| `EAS_NO_DEPRECATION_WARN=1` | Suppress v0.2 alias deprecation warnings. |
| `EAS_INIT_MODE=<mode>` | Bypass the `eas init` prompt; same values as `--mode`. |
| `EAS_INTERVIEW_JSON=<path>` | Pre-fill the `eas init` greenfield interview from JSON. |
| `EDITOR` | Used by `eas config edit`. Falls back to `vi`. |
