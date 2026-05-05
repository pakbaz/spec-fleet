# SpecFleet Quick Start (v0.6)

Zero to a fully reviewed feature on Copilot CLI in under 10 minutes.

---

## 1. Prerequisites

| Requirement | Why |
| --- | --- |
| **Node.js ≥ 20** | SpecFleet is ESM + TypeScript |
| **GitHub Copilot CLI** signed in (`copilot --version`) | We shell out to it |
| **A Copilot-enabled GitHub account** | Required by Copilot CLI |
| **Git** | SpecFleet reads `git diff --cached` for `check --staged` |

SpecFleet does **not** ship a separate auth flow — it inherits whatever
credentials `copilot` already has.

---

## 2. Install

From npm:

```bash
npm install -g @pakbaz/specfleet
specfleet --version          # → 0.6.0
```

From source:

```bash
git clone https://github.com/pakbaz/spec-fleet.git
cd spec-fleet
npm install && npm run build && npm link
```

---

## 3. Initialize a workspace

```bash
mkdir ~/code/todo-api && cd ~/code/todo-api
git init
specfleet init --non-interactive
```

What lands on disk:

```text
.specfleet/
  instruction.md        ← corporate / project constitution (immutable in reviews)
  project.md            ← stack + layout summary (write this yourself)
  config.json           ← models.default + models.review
  charters/             ← 7 charters (orchestrator/architect/dev/test/devsecops/compliance/sre)
  skills/               ← reusable how-tos
  specs/                ← per-spec artefacts go here
  scratchpad/           ← shared working memory per spec
  runs/                 ← JSONL transcripts of every dispatch
.github/
  agents/               ← mirror of charters → run `copilot --agent dev` directly
  prompts/              ← 8 specfleet.<phase>.prompt.md files
  instructions/         ← 3 path-scoped instructions (coding-style/testing/compliance)
  copilot-instructions.md
```

Customise the constitution before any phase runs:

```bash
$EDITOR .specfleet/instruction.md
$EDITOR .specfleet/project.md
```

---

## 4. The eight-phase pipeline

Once for each feature:

```bash
specfleet specify    "todo-api"      --description "REST API with JSON storage, CRUD, validation"
specfleet clarify    todo-api
specfleet plan       todo-api
specfleet tasks      todo-api
specfleet analyze    todo-api
specfleet implement  todo-api
specfleet review     todo-api        # uses models.review automatically (cross-model gate)
specfleet checklist  todo-api
```

Each command:

1. Renders `.github/prompts/specfleet.<phase>.prompt.md` against the
   spec's artefacts.
2. Spawns `copilot -p - --agent <charter> --no-interactive` and pipes the
   prompt via stdin.
3. Writes the model's response into the matching artefact file under
   `.specfleet/specs/<spec-id>/`.
4. Advances the spec's status.

You can override the charter (`--charter architect`) or model
(`--model gpt-5.1`) per call.

---

## 5. Review the result

`specfleet review` writes `.specfleet/specs/<id>/review.md` using the
**review model** (defaults to `gpt-5.1`) so a different model than the one
that implemented the change gates the diff. Pass `--same-model` to bypass
this if you really want the implementer to also review.

---

## 6. Sanity checks

```bash
specfleet check                # validates charters / mirror / Copilot CLI / prompts / MCP manifests
specfleet check --staged       # secret scan over `git diff --cached`
specfleet check --fix          # re-mirrors charters
```

---

## 7. Optional: shared scratchpad as MCP server

```bash
specfleet mcp serve            # stdio JSON-RPC; expose to Copilot CLI via .mcp.json
```

Tools exposed: `query_charter`, `query_constitution`, `query_project`,
`scratchpad_read`, `scratchpad_append`, `scratchpad_search`,
`scratchpad_archive`. All seven default off — you only enable them per
charter via `mcpServers: ["specfleet"]`.

---

## 8. Migrating from v0.5

```bash
specfleet init --from-v5
```

Archives the old `.specfleet/{audit,checkpoints,index,plans,instruction.md}`
into `.specfleet/_v5-archive/` and re-scaffolds the v0.6 layout. See
[migration-from-0.5.md](migration-from-0.5.md) for the full rewrite.
