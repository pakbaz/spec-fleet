# SpecFleet Quick Start

Get from zero to a working autonomous-agent ALM run in under 10 minutes.

---

## 1. Prerequisites

| Requirement | Why |
|---|---|
| **Node.js ≥ 20** | SpecFleet is ESM + TypeScript |
| **GitHub Copilot CLI** signed in (`copilot --version`) | The SDK reuses Copilot auth |
| **A Copilot-enabled GitHub account** (Pro/Business/Enterprise) | Required by the SDK |
| **Git** | SpecFleet reads `git diff` for `specfleet review` |

> SpecFleet does **not** ship a separate auth flow. It piggybacks on whatever
> credentials your local `copilot` CLI has cached.

---

## 2. Install SpecFleet

From npm:

```bash
npm install -g @pakbaz/specfleet
specfleet --version
```

Or from source:

```bash
git clone https://github.com/<your-org>/specfleet.git
cd specfleet
npm install
npm run build
npm link               # exposes `specfleet` on your PATH
```

Verify:

```bash
specfleet --version          # → 0.4.1
specfleet --help
```

---

## 3. Greenfield: brand-new project in 90 seconds

```bash
mkdir ~/code/todo-api && cd ~/code/todo-api
git init
specfleet init --non-interactive
```

What you get:

```
.specfleet/
  instruction.md        ← corporate standards (sample NoviMart Corp included)
  charters/             ← 29 agent charters (orchestrator + 6 roles + 19 subagents)
  policies/secrets.json ← built-in secret patterns + extension point
  mcp/                  ← scoped MCP server manifests
  skills/               ← lazy-loaded markdown procedures
  audit/                ← JSONL audit log (one file per session)
  decisions.md          ← append-only ADR-lite log written by agents
.github/
  agents/               ← flat mirror of charters for graceful degradation
                          (developers running plain `copilot` inherit the same prompts)
```

Customize the corporate standards before running anything:

```bash
$EDITOR .specfleet/instruction.md       # set your runtimes, frameworks, forbidden libs, contacts
```

> **Tip:** in a real org, drop your team's `instruction.md` into a private
> repo and pass it via `specfleet init --instruction /path/to/your-corp.md`. The
> file is **immutable** at runtime — agents cannot rewrite it.

---

## 4. Plan → Implement

```bash
specfleet plan "Build a TODO REST API in Express with file-based JSON storage, full CRUD, request validation, and Vitest tests"
```

The Main Orchestrator returns a YAML task list under `.specfleet/plans/<timestamp>.md`:

```yaml
## Tasks
- id: scaffold
  agent: dev
  subagent: backend
  title: Scaffold Express app + folder layout
  brief: Create src/, routes/, models/, tests/. Wire JSON file persistence.
- id: crud
  agent: dev
  subagent: backend
  title: Implement /todos CRUD
  depends_on: [scaffold]
- id: tests
  agent: test
  subagent: api
  title: Vitest API tests for all endpoints
  depends_on: [crud]
- id: ci
  agent: devsecops
  subagent: cicd
  title: GitHub Actions workflow
  depends_on: [tests]
```

Review and edit, then execute:

```bash
specfleet run --all
```

SpecFleet spawns each task in an **isolated SDK session** with its own charter
prompt, tool allowlist, and ≤80K token budget. The orchestrator never holds
the dev's working code; the dev never sees the test runner's stack traces.

---

## 5. Brownfield: onboard an existing repo

```bash
cd ~/code/legacy-monolith
specfleet init --mode brownfield --non-interactive
```

Brownfield mode runs a stack heuristic (package.json / pyproject.toml /
go.mod / pom.xml / Cargo.toml + Dockerfile) and drafts `.specfleet/project.md` —
the agents' cheat sheet for the codebase. **Edit it** before planning:

```bash
specfleet config edit                            # opens .specfleet/instruction.md
$EDITOR .specfleet/project.md                    # edit the project cheat sheet
specfleet plan "Add OpenTelemetry instrumentation to all HTTP handlers"
specfleet run --all
```

---

## 6. Review changes

After agents have edited files (or before you commit anything they wrote):

```bash
git add -A
specfleet review                        # Compliance + Architect re-review the staged diff
```

Review output is appended to `.specfleet/decisions.md` and surfaced inline.

---

## 7. Observe and audit

```bash
specfleet status                        # snapshot: charters, plans, recent audit, pending gates
specfleet log --tail                    # stream JSONL events live
specfleet log --since 1h --agent dev/backend
specfleet log <sessionId>               # replay one session as a redacted timeline
specfleet check                         # validate .specfleet/ integrity (charter graph, MCP refs, caps)
specfleet check --deep                  # also re-verify the audit hash chain
```

Every prompt, tool call, permission decision, and policy block is recorded
in `.specfleet/audit/<sessionId>.jsonl`.

---

## 8. Customize charters and configuration

Everything agent-related lives under `.specfleet/`. The `specfleet config` command is
the single entry point for inspecting and editing it:

```bash
specfleet config list                                    # every wired config in one table
specfleet config show dev                                # print the dev charter
specfleet config edit sre                                # open sre charter in $EDITOR
specfleet config new charter dev/graphql                 # scaffold a new subagent charter
specfleet config validate                                # CI-friendly schema check
specfleet config diff                                    # drift vs bundled templates
```

The mirror to `.github/agents/` is regenerated automatically on save, so
plain `copilot` users inherit the new agent.

---

## 9. CI integration

In your repo root, create `.github/workflows/specfleet-review.yml`:

```yaml
name: SpecFleet Review
on: [pull_request]
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm i -g @pakbaz/specfleet
      - run: specfleet check
      - run: specfleet review
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Pair it with a `CODEOWNERS` rule (template at
`templates/CODEOWNERS.example`) so any PR that touches
`.specfleet/instruction.md` requires a security/compliance reviewer.

---

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| `No .specfleet/ directory found` | Run `specfleet init` in the repo root |
| `Charter "x" references missing parent "y"` | Run `specfleet config validate`; either add `y` or remove the reference |
| `TokenBudgetExceededError` | The agent's prompt + history exceeds its `maxContextTokens`. Split the task or raise the cap (≤95K) in its charter. |
| `policy.block` events in audit log | An agent attempted a write to an immutable path or used a tool outside its allowlist — expected behavior, review the charter |
| `permissionGate denied: not-in-allowlist` | Add the tool to the charter's `allowedTools` if intended |
| Agent runs but produces nothing useful | Inspect with `specfleet log <sessionId>` — every prompt and tool call is there |

---

## What's next

- [`docs/architecture.md`](architecture.md) — three-tier hierarchy and budget enforcement
- [`docs/adr/`](adr/) — design decisions (hybrid runtime, token budget, charter format)
- [`README.md`](../README.md) — full feature reference

Welcome to autonomous ALM. 🚀
