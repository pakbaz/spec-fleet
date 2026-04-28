# ADR-0003: Charter format — Markdown frontmatter

## Status
Accepted (MVP).

## Context
Agents need a versioned, reviewable contract. The Copilot CLI consumes
`.agent.md` (markdown + YAML frontmatter), Spec Kit uses `*.spec.md`, Squad
uses YAML in `agents/`. We want one format that is human-friendly, fits PR
review, and can be mirrored to `.github/agents/`.

## Decision
Use **`<name>.charter.md`** — YAML frontmatter (validated by `CharterSchema`)
+ markdown body (the prompt). The schema declares: name, displayName, role,
tier, parent, description, `maxContextTokens`, `allowedTools`, `spawns`,
`mcpServers`, `skills`, `model`, `requiresHumanGate`, body.

Charters are namespaced with `/` (e.g. `dev/frontend`); when mirrored to
`.github/agents/` the slash is flattened to `-` to satisfy the CLI's flat
namespace.

## Consequences
+ Reviewable (PR-friendly).
+ Mirrors cleanly into the CLI's expected format.
+ Easy to scaffold (`specfleet config new charter`).
- Two paths to the same agent (charter + mirror) — must keep in sync;
  `mirrorCharters` runs on every `SpecFleetRuntime.open()`.
