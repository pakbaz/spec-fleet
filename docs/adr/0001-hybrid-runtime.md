# ADR-0001: Hybrid SDK runtime + repo-resident artifacts

## Status

Superseded by [ADR-0004 — Thin shim over Copilot CLI](0004-thin-shim.md) (v0.6).

## Context

We need to deliver autonomous ALM with three properties: **enforceable** policy
(token budgets, allowlists, secret redaction), **reviewable** configuration
(admins want PRs, not opaque binaries), and **graceful degradation** (devs
running plain `copilot` should still inherit the safer defaults).

Three options were evaluated:

1. **CLI wrapper only** — extend `copilot` config and call out from a thin
   shell. Simple, but cannot deterministically enforce a 100K cap mid-session
   and policy hooks can be bypassed by user CLI config.
2. **SDK app only** — own everything inside `@github/copilot-sdk` sessions.
   Maximum control, but no in-repo source of truth → admins cannot review what
   the agents actually do.
3. **Repo-resident only** — drop charters in `.github/agents/` and rely on
   `copilot` to consume them. Reviewable, but no runtime to enforce budgets,
   audit, or redact.

## Decision

Adopt option (1) + (3): a **TypeScript `specfleet` CLI** built on `@github/copilot-sdk`
plus a **`.specfleet/` repo-resident schema**. The runtime is the only path to the
SDK; charters in `.specfleet/charters/` are the source of truth and are mirrored to
`.github/agents/` for graceful degradation when devs run `copilot` directly.

## Consequences

- Deterministic enforcement (budget, allowlist, immutability, redaction, audit).
- Everything reviewable in PR (charters + policies + mcp + skills).
- Graceful degradation via mirror.
- Higher build effort than a pure wrapper.
- Two surfaces (`specfleet` *and* `copilot`) — must keep mirror in sync (handled by
  `mirrorCharters` on every `SpecFleetRuntime.open()`).
