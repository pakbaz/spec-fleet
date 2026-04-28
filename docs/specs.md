Questions:

1. How do we position agents to deliver production ready code faster? i.e. less wasted code
2. How do I use agents in a structured way so it has maximum knowledge of the product? (i.e. MCP server)
3. How do we find bugs / maintain code so as our velocity improves we can keep up with identifying and firefighting more bugs? (SRE agent)
4. How do we leverage AI to help us self-improve the agents and documentation so it self matures? (harness management)
5. Let's consider SpecKit and other frameworks as well (GSD?) as we move beyond POCs with it.

Scope - Questions to Address:

- How do we position agents to deliver production ready - code faster? i.e. less wasted code
- How do we use agents in a structured way so it has - maximum knowledge of the product?
- How do we leverage AI to help us self-improve the agents - and documentation so it self matures? (harness - management)
- Practical design patterns with Agent Workflows

Four Pillars in Approach:
- Standardized agents
- Shared context (org memory)
- Deterministic workflows
- Continuous evaluation + improvement loops 
- Skills, Agents, Instructions and best practices for each

Providing Organizational Context
- Compare 4 approaches  to providing product / org and business goal context
Org-level instructions (emerging)
Copilot Spaces
Custom agents
MCP server (Model Context Protocol)
- Recommended architecture
Harness management and iterative agent maturity 
---

## How EAS v0.2 answers this

Each of the five questions above maps to specific commands, files, and
docs in this repo as of v0.2.

### Q1 — Production-ready code faster (less wasted code)

- **`eas spec new <name>`** — author a GSD/SpecKit-shaped spec
  ([`templates/spec.md`](../templates/spec.md)) before any code is
  written; ambiguity gets resolved on cheap text, not expensive runs.
- **`eas plan --from-spec <id>`** — the orchestrator ingests the spec
  and decomposes it into per-role briefs, so Dev never starts before
  Architect has signed off.
- **Skills library** — production skills under
  [`templates/skills/`](../templates/skills/)
  (`security-review`, `perf-review`, `accessibility`, `observability`,
  `iac-review`, `dependency-hygiene`) are loaded lazily by role agents
  to enforce a shared "definition of done".
- **`eas eval`** — benchmarks against each charter catch regressions
  in code quality before they ship; see
  [`docs/harness-management.md`](harness-management.md).

### Q2 — Structured product knowledge / MCP

- **`eas mcp serve`** — stdio MCP server exposing
  `query_decisions`, `query_charter`, `query_project`, `query_audit`
  to any consumer (Copilot CLI, VS Code, Claude Desktop).
- **`.eas/decisions.md`** — the canonical org decision log; every
  accepted tune diff or material design choice lands here and is
  queryable through MCP.
- **Charter library** — [`templates/charters/`](../templates/charters/)
  holds the 32 reviewed role charters that encode product/team norms
  per agent.
- **Strategy choice** — see
  [`docs/context-strategies.md`](context-strategies.md): EAS uses
  custom charters (governance) **plus** the MCP server (fresh data).

### Q3 — SRE bug-finding at velocity

- **`eas sre triage`** — consumes SARIF (CodeQL, Semgrep, Trivy…)
  and the audit log; the `sre` charter produces a triage report at
  `.eas/triage/<ts>.md`.
- **`templates/skills/security-review.md`** — security-review skill
  loaded by SRE and Compliance agents.
- **Other skills** — `perf-review`, `observability`, `iac-review`,
  `dependency-hygiene` close the rest of the operational loop.
- **Audit log** — `.eas/audit/<sessionId>.jsonl` (hash-chained, see
  [`docs/security.md`](security.md)) is queryable via MCP, so the
  SRE agent can correlate runtime events with code changes.

### Q4 — Self-improving harness

- **`eas eval`** — runs benchmarks under
  [`templates/benchmarks/`](../templates/benchmarks/), appends one
  JSON line per benchmark to `.eas/eval/scoreboard.jsonl`.
- **`eas tune`** — reads the scoreboard + audit + decisions and
  drafts an advisory unified diff against the relevant charter at
  `.eas/tune/<ts>.diff`. Never auto-applies.
- **`.eas/decisions.md`** — captures the human verdict on each tune
  diff, closing the loop.
- **[`docs/harness-management.md`](harness-management.md)** — the
  full eval → tune → review loop, cadence (per-PR / weekly /
  monthly / quarterly), and anti-patterns to avoid.

### Q5 — SpecKit / GSD beyond POCs

- **`eas spec new <name>`** — `templates/spec.md` is a GSD-shaped
  spec template (problem, decision, scope, acceptance, risks).
- **`eas spec list`** — enumerate active specs in `.eas/specs/`.
- **`eas plan --from-spec <id>`** — the orchestrator's primary
  on-ramp: every plan can be traced back to a reviewed spec.
- **`.eas/decisions.md`** — the durable product-knowledge surface
  (queryable via `eas mcp serve`) that survives across specs and
  plans.
