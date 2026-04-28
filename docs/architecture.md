# EAS Architecture

## Three-tier hierarchy

```
Main Orchestrator (root)
├── Architect      → SOLID / Readable / Maintainable / Scalable / Interviewer
├── Dev            → Frontend / Backend / Database / Messaging
├── Test           → Unit / API / UI / E2E
├── DevSecOps      → IaC / CI-CD / Deploy / Idempotency
├── Compliance     → Policies (one per regulatory domain)
└── SRE            → Availability / Performance / Observability / AIOps
```

Each tier runs in an **isolated SDK session**:

- The orchestrator never holds Dev's working code in its context.
- A Dev subagent never holds Test's coverage data.
- The parent communicates downward via a small **brief**; the child returns a
  small **structured envelope** (summary + files + follow-ups).

## Token budget enforcement

| Layer | Mechanism |
|---|---|
| Per-charter cap | `maxContextTokens` in frontmatter (≤ 95K) |
| Pre-flight check | `EasSession.ask()` estimates + blocks at cap |
| Compaction | SDK `infiniteSessions: { enabled: true }` |
| Cross-agent memory | `.eas/decisions.md` + `.eas/checkpoints/` |
| RAG (Phase 2) | `.eas/index/` — agents query, never dump |

## Governance

| Concern | Mechanism |
|---|---|
| Immutable instruction.md | `permissionGate` blocks `write` to it + CODEOWNERS |
| Tool allowlist | Per-charter `allowedTools` enforced in `permissionGate` |
| MCP scope | Per-charter `mcpServers` list; `doctor` verifies manifests |
| Secret redaction | `redact()` over delegate output before parent sees it |
| Human gates | Per-charter `requiresHumanGate: true` |
| Audit | JSONL stream per session in `.eas/audit/` |

## Brownfield routing

`eas onboard` runs a heuristic detector (package.json / pyproject.toml /
go.mod / pom.xml / Cargo.toml + Dockerfile) and drafts a `project.md`. Phase 2
will replace this with an Architect-driven RAG-indexed analyzer.

## Modernization (Phase 3)

`eas modernize` will load the existing project, generate a wave plan, and
dispatch each wave through the orchestrator. Long-running waves shell out to
`copilot --no-interactive -p '<brief>' --agent <name>` (read-heavy parallelism)
or `copilot /delegate` for cloud execution.

## Graceful degradation

`mirrorCharters` writes flat `.github/agents/*.agent.md` files so a developer
running `copilot` directly inherits the same prompt + tool allowlist — just
without runtime enforcement (no audit log, no secret redaction). The repo is
the source of truth; the runtime is the policy enforcement point.
