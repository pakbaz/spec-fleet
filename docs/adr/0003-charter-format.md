# ADR-0003: Charter format as flat task contracts

## Status

Accepted with v0.6 revisions.

## Context

Agents need a versioned, reviewable contract that Copilot CLI can also consume
directly. v0.5 used a hierarchical charter graph with roles, tiers, parents,
declared spawns, signatures, skills, and human gates. That made the framework
feel heavier than the current Spec-Kit and Copilot CLI ecosystem needs.

## Decision

Use one flat markdown file per charter:

```yaml
---
name: dev
description: Implements code for the active spec.
maxContextTokens: 60000
allowedTools: []
mcpServers: []
instructionsApplyTo: []
---
```

The body is a task contract with `## Goal`, `## Inputs`, `## Output`, and
`## Constraints`. It must avoid persona phrasing such as "You are the X agent".

Charter names are kebab-case with no slashes. `mirrorCharters()` writes each
file to `.github/agents/<name>.agent.md` with Copilot CLI-compatible
frontmatter (`name`, `description`, optional `tools`, optional `model`).

## Consequences

- Reviewable in PRs and easy to understand.
- Mirrors cleanly into Copilot CLI custom agents.
- No predeclared subagent graph to keep in sync with Copilot CLI runtime
  behavior.
- Existing v0.5 charters need migration; `specfleet init --from-v5` archives
  them and scaffolds the new shape.
- Human approval gates move out of charter schema and into normal PR / branch
  protection / reviewer workflow.
