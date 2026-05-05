# Providing Organizational Context to AI Agents

<!-- markdownlint-disable MD036 MD060 -->

There are four common ways to ground an AI coding agent in your
organization's standards, product knowledge, and business goals. Each has a
different trade-off between **freshness**, **governance**, **per-role
fidelity**, and **operational cost**. SpecFleet combines two of them — read on for
why.

---

## 1. Org-level instructions

Static markdown shipped at the GitHub org or repo level. The canonical
example today is **GitHub Copilot custom instructions**
(`.github/copilot-instructions.md`) plus per-repo `AGENTS.md` files.

**How it works.** The host (Copilot, Cursor, Codex, etc.) auto-injects the
file's contents into every model call's system prompt. Authoring is just
markdown in a repo; review is a normal PR.

**Strengths**

- Zero infra. PR-reviewable. Works on day one.
- Universally honored by current coding agents.
- Cheap: bytes are free, no servers to run.

**Weaknesses**

- One file, one tone. Hard to give Architect, Dev, and Compliance different
  guidance without bloating every prompt.
- Stale by construction. Last commit wins; no awareness of yesterday's
  decision-record.
- No query API — agents can't ask "what did we decide about retries last
  month?", they only get whatever a human pasted into the file.

**When to use.** Always, as a baseline. Even if you adopt richer strategies
below, ship a thin `copilot-instructions.md` so an unenrolled developer using
plain Copilot still gets a consistent voice.

---

## 2. Copilot Spaces

A curated, grounded context bundle hosted in GitHub. You pick repos,
branches, files, and free-text notes; Copilot uses them as retrieval
context for chat in github.com.

**How it works.** Authors assemble a Space in the GitHub UI. Consumers
chat against the Space and get answers grounded in the bundled material.

**Strengths**

- Excellent for onboarding humans and for product Q&A.
- Curated — you can include only what's relevant, exclude noise.
- No code to maintain.

**Weaknesses**

- UI-bound. Not directly consumable by a CLI agent or an SDK session today.
- Spaces are read by humans-in-Copilot-chat; piping their content into a
  scripted agent run requires copy-paste or screen-scraping.
- Authoring is point-and-click, not git-reviewable in the same way as a
  markdown file.

**When to use.** Human-facing knowledge surface — "what does this product
do, who owns it, where are the runbooks". Pair with strategy 3 or 4 for
machine-facing context.

---

## 3. Custom agents / charters

Per-role markdown contracts with frontmatter. The SpecFleet approach: every
agent (Architect, Dev, Test, Compliance, SRE…) has a versioned
`*.charter.md` that declares its tools, MCP scopes, token cap, and prompt
body. The CLI fleet's `*.agent.md` format is the same shape.

**How it works.** A loader reads the charter, stamps it into a fresh SDK
session's system prompt, and enforces the declared `allowedTools` /
`mcpServers` / `maxContextTokens`. One charter per role, reviewed via PR.

**Strengths**

- **Per-role tone and scope.** Dev sees coding standards; Compliance sees
  the SOC 2 control map. Neither carries the other's payload.
- **Centralized governance.** Charters live in `.specfleet/charters/`, owned by
  CODEOWNERS, validated by `specfleet check`.
- **Deterministic.** Same charter + same brief → same boundaries on every
  run, on every developer's machine.
- **Layered.** A charter can `extends:` another, so a baseline org charter
  can be specialized per team.

**Weaknesses**

- Static text. Fresh data (today's decision record, last night's incident)
  doesn't appear unless a human re-edits the charter.
- Authoring discipline required — drift between charters and reality is a
  real failure mode (see `docs/harness-management.md`).

**When to use.** Whenever you need different agents to behave differently
under governance. This is SpecFleet's primary mechanism.

---

## 4. MCP servers (Model Context Protocol)

A small program that speaks the [Model Context
Protocol](https://modelcontextprotocol.io) over stdio or HTTP and exposes
**tools** the agent can call to fetch context on demand.

**How it works.** The agent host registers the MCP server (`mcp.json`).
At runtime, the model sees a tool list (`query_charter`,
`query_constitution`, `scratchpad_read`, …) and calls them when it needs context.
The server returns fresh data from whatever backing store you point it at
— filesystem, database, internal API.

SpecFleet ships `specfleet mcp serve` which exposes per-spec scratchpads,
charters, the constitution, and project notes over stdio MCP for any
consumer that supports MCP (Copilot CLI, VS Code, Claude Desktop, etc.).

**Strengths**

- **Fresh.** The server reads from disk / DB at every call. Yesterday's
  decision is visible today with no re-deploy.
- **Programmatic.** Any consumer that speaks MCP gets the same context;
  not UI-bound.
- **Queryable.** The agent asks for what it needs instead of scrolling
  through everything.
- **Composable.** Multiple MCP servers per agent (egress allowlisted per
  charter).

**Weaknesses**

- Requires running a process. Trivial for stdio, real ops cost for HTTP.
- Authoring a tool surface is a design exercise — bad MCP tools are
  worse than no MCP tools (verbose, ambiguous, expensive).
- Network-aware → must be reasoned about under air-gap (see
  `docs/security.md`).

**When to use.** Whenever the context you need changes faster than you
can re-author a charter, or when multiple consumers (CI, CLI, IDE) need
the same answer.

---

## Recommendation matrix

| Need                       | Org instructions | Copilot Spaces | Custom agents / charters | MCP server |
| -------------------------- | :--------------: | :------------: | :----------------------: | :--------: |
| Centralized governance     |        ⚠️         |       ❌        |            ✅             |     ⚠️      |
| Fresh data                 |        ❌         |       ⚠️        |            ❌             |     ✅      |
| Per-role tone              |        ❌         |       ❌        |            ✅             |     ⚠️      |
| Minimal infra              |        ✅         |       ✅        |            ✅             |     ⚠️      |
| Machine-consumable         |        ✅         |       ❌        |            ✅             |     ✅      |
| PR-reviewable as code      |        ✅         |       ❌        |            ✅             |     ✅      |
| Queryable on demand        |        ❌         |       ⚠️        |            ❌             |     ✅      |
| Air-gap friendly           |        ✅         |       ❌        |            ✅             |     ⚠️      |

Legend: ✅ strong fit · ⚠️ partial / depends · ❌ poor fit.

---

## SpecFleet recommendation

> **Use (3) for governance and (4) for fresh data.**

Charters give you per-role guardrails and PR-reviewable contracts. An MCP
server gives the same charters live access to organizational memory that
moves faster than the charter file does.

Concretely:

- Author one charter per role under `.specfleet/charters/` (strategy 3).
- Run `specfleet mcp serve` to expose scratchpads, project notes, the
  constitution, and the charter library to every agent (strategy 4).
- Optionally also publish a thin `.github/copilot-instructions.md`
  (strategy 1) for developers using Copilot directly without the SpecFleet
  runtime.
- Use Copilot Spaces (strategy 2) for human onboarding docs that don't
  need to feed automated runs.

This is the architecture SpecFleet v0.6 ships out of the box.
