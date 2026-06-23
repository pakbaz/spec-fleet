# SpecFleet Quick Start (v0.7)

Add charters, a shared scratchpad, and a charter-compliance review to your
[Spec Kit](https://github.com/github/spec-kit) workflow in under 10 minutes.

---

## 1. Prerequisites

| Requirement | Why |
| --- | --- |
| **Spec Kit** (`specify`) ≥ 0.1.0 | SpecFleet installs as a Spec Kit extension |
| **An AI coding agent** (VS Code Copilot, Claude Code, Cursor, …) | Runs the command files |
| **Git** | Features live on branches; artifacts are committed |

SpecFleet ships no separate auth flow — it runs inside whatever agent you already use.

---

## 2. Install the extension

```bash
# In a Spec Kit project
specify extension add specfleet \
  --from https://github.com/pakbaz/spec-fleet/archive/refs/tags/v0.7.0.zip

specify extension list      # → specfleet (0.7.0) — SpecFleet
```

Local development checkout instead:

```bash
git clone https://github.com/pakbaz/spec-fleet.git
specify extension add --dev ./spec-fleet
```

This registers four commands with your agent: `speckit.specfleet.charter`,
`speckit.specfleet.scratchpad`, `speckit.specfleet.review`, `speckit.specfleet.check`.

---

## 3. (Optional) configure

```bash
mkdir -p .specify/extensions/specfleet
cp specfleet-config.template.yml .specify/extensions/specfleet/specfleet-config.yml
$EDITOR .specify/extensions/specfleet/specfleet-config.yml
```

Set `models.default` (implementation) and `models.review` (must differ — that cross-model
gate is the point). Defaults are `claude-sonnet-4.5` and `gpt-5.1`.

---

## 4. Use it alongside the core phases

SpecFleet does not drive the pipeline — you keep running the core Spec Kit commands and
add SpecFleet's layer where it helps:

```text
/speckit.specify   "todo-api: REST API with JSON storage, CRUD, validation"
/speckit.specfleet.charter architect      # task contract for the design work
/speckit.plan
/speckit.tasks
/speckit.specfleet.scratchpad             # open shared working memory for the feature
/speckit.implement
/speckit.specfleet.review                 # cross-model, charter-compliance gate
/speckit.specfleet.check                  # validate charter + scratchpad integrity
```

Artifacts land next to the core ones, under the feature's `specs/<feature>/` directory:

```text
specs/todo-api/
  spec.md          ← core Spec Kit
  plan.md          ← core Spec Kit
  tasks.md         ← core Spec Kit
  charter.md       ← speckit.specfleet.charter
  scratchpad.md    ← speckit.specfleet.scratchpad
  review.md        ← speckit.specfleet.review
```

The optional **hooks** (`before_plan` → charter, `after_tasks` → scratchpad,
`after_implement` → review) prompt to run these automatically — enable them when you want
the workflow on autopilot.

---

## 5. The charter (task contract)

A charter scopes one feature for one **role** (orchestrator / architect / dev / test /
devsecops / compliance / sre) with Goal / Inputs / Output / Constraints. It is committed
to git and read by later phases, so intent stays explicit and reviewable.

## 6. The shared scratchpad

A four-section working memory — **Findings · Decisions · Open Questions · Files Touched**
— that every phase appends to (author-prefixed, append-only). Later phases absorb earlier
findings without re-running prior work.

## 7. The charter-compliance review

`speckit.specfleet.review` is read-only and meant to run with a *different* model than the
implementation. It grades the diff against the **charter** and **scratchpad** and emits a
verdict (`APPROVE` / `REQUEST_CHANGES` / `BLOCK`) with file-cited findings.

---

## 8. Optional: shared scratchpad as an MCP server

The repository also ships an optional TypeScript engine that can serve the scratchpad over
MCP for agents that prefer tool calls:

```bash
git clone https://github.com/pakbaz/spec-fleet.git && cd spec-fleet
npm install && npm run build
node dist/cli.js mcp serve     # stdio JSON-RPC
```

See [cli.md](cli.md) for the engine and MCP details. It is not required to use the
extension.

---

## 9. Try the samples

| Sample | Mode | Stack | Feature walked through |
|--------|------|-------|------------------------|
| [`sample/novimart-app/`](../sample/novimart-app/) | greenfield | .NET 10 + React/Vite + Cosmos | `checkout-hardening` |
| [`sample/hermes-telemetry/`](../sample/hermes-telemetry/) | brownfield | Go 1.22 (stdlib only) | `origin-allowlist` |

Each sample includes a populated workspace with the feature's `charter.md`, `scratchpad`,
phase artifacts, and review — so you can read a finished SpecFleet feature end to end.
