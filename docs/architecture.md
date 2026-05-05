# SpecFleet Architecture (v0.6)

SpecFleet v0.6 is **a thin shim over the GitHub Copilot CLI** that runs the
Spec-Kit pipeline (specify · clarify · plan · tasks · analyze · implement ·
review · checklist) with cross-model review and a shared scratchpad for
multi-charter coordination.

We deliberately do **not** ship a runtime, an SDK, a policy engine, or a
permission gate. Trust comes from `.specfleet/` and `.github/` being
plain files committed to your repo and reviewed in PRs.

## Big picture

```text
                     ┌─────────────────────────────────────┐
                     │   .specfleet/instruction.md         │  constitution
                     │   .specfleet/project.md             │  what we're building
                     │   .specfleet/charters/*.charter.md  │  task contracts
                     │   .specfleet/skills/*.md            │  reusable how-tos
                     └─────────────────────────────────────┘
                                       │
                                       ▼
   ┌──── specfleet specify "X" ────┐   ┌──── .github/prompts/specfleet.<phase>.prompt.md ────┐
   │  spec.md  → status: draft     │ → │  rendered with mustache-lite placeholders            │
   └────────────────────────────────┘   └──────────────────────────────────────────────────────┘
                                       │
                                       ▼
                     ┌─── src/runtime/dispatch.ts ───┐
                     │  spawn copilot -p - …          │  prompt via stdin
                     │  --agent <charter>             │  charter as agent
                     │  --model <model>               │  default vs review
                     │  --allow-tool …                │  least privilege
                     │  --no-interactive              │  CI-safe
                     └────────────────────────────────┘
                                       │
                                       ▼
                     ┌─── .specfleet/specs/<id>/ ───┐
                     │  spec.md / clarifications.md  │
                     │  plan.md  / tasks.md          │
                     │  analysis.md                  │
                     │  review.md / checklist.md     │
                     └───────────────────────────────┘
                     ┌─── .specfleet/scratchpad/<id>.md ┐
                     │  shared work for implement runs  │
                     └──────────────────────────────────┘
                     ┌─── .specfleet/runs/<id>.jsonl ┐
                     │  start / stdout / stderr / exit │
                     └───────────────────────────────┘
```

## Eight pipeline phases

| Phase | Owner charter | Artefact written |
| --- | --- | --- |
| `specify` | orchestrator | `spec.md` (status → `draft`) |
| `clarify` | orchestrator | `clarifications.md` (status → `clarifying`) |
| `plan` | architect | `plan.md` (status → `planned`) |
| `tasks` | orchestrator | `tasks.md` (status → `tasked`) |
| `analyze` | architect | `analysis.md` (status → `tasked`) |
| `implement` | dev | `.specfleet/scratchpad/<id>.md` (status → `implementing`) |
| `review` | architect | `review.md` — runs with `models.review` |
| `checklist` | compliance | `checklist.md` (status → `done`) |

Charters can be overridden per-call (`--charter dev`, etc.). Models can be
overridden per-call (`--model gpt-5.1`). The `review` phase defaults to
the `models.review` value so reviewer ≠ implementer.

## Charter shape

Charters are pure task contracts (no personas):

```markdown
---
name: dev
description: Implements code for the active spec.
maxContextTokens: 60000
allowedTools: [read, write, shell, mcp]
mcpServers: []
---

## Goal
…

## Inputs
…

## Output
…

## Constraints
…
```

Init mirrors every `*.charter.md` to `.github/agents/<name>.agent.md` so
that running `copilot --agent <name>` directly (outside SpecFleet)
inherits the exact same task contract.

## Cross-model review (ADR-0005)

`.specfleet/config.json`:

```json
{
  "models": {
    "default": "claude-sonnet-4.5",
    "review": "gpt-5.1"
  },
  "defaultAllowTool": [],
  "defaultMaxContextTokens": 60000,
  "defaultMcpServers": []
}
```

`specfleet review` automatically uses `models.review`. Pass `--same-model`
to disable cross-model review for that single call.

## Shared scratchpad

`.specfleet/scratchpad/<spec-id>.md` is the working memory shared between
charters during `implement`. Four canonical sections:

1. **Findings**
2. **Decisions**
3. **Open Questions**
4. **Files Touched**

Surfaced via the optional MCP server (`specfleet mcp serve`) as four tools:
`scratchpad_read`, `scratchpad_append`, `scratchpad_search`,
`scratchpad_archive`. The same server also exposes `query_charter`,
`query_constitution`, `query_project` so charters can self-look-up
without dumping everything into context.

## Token budget gate

Before each dispatch we estimate the prompt size with `estimateTokens()`
and compare against the charter's `maxContextTokens` (default 60K, hard
ceiling 95K). If the rendered prompt exceeds the cap we abort with an
explanatory error so the user can split the spec.

## What we removed (and why)

- **`@github/copilot-sdk` dependency** — Copilot CLI does the same job.
- **Hierarchical subagents (tier/parent/spawns)** — Copilot CLI spawns
  subagents at runtime; we don't pre-declare them.
- **Personas (`You are the X agent…`)** — they bias the model. Charters
  describe Goal/Inputs/Output/Constraints only.
- **Audit hash chain & policy DSL** — git history + CODEOWNERS + branch
  protection cover this without parallel infrastructure.
- **`onboard`, `replay`, `tune`, `sre`, `eval`, `log`, `status`, `run`** —
  collapsed into `init`, `check`, `config`, `mcp serve`, and the eight
  phase verbs.

See [docs/migration-from-0.5.md](migration-from-0.5.md) and
[docs/adr/0004-thin-shim.md](adr/0004-thin-shim.md) for the full
rationale.
