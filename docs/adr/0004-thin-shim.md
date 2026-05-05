# ADR-0004: SpecFleet is a thin shim over Copilot CLI

<!-- markdownlint-disable MD060 -->

- **Status**: Accepted (v0.6)
- **Date**: 2026-05-01
- **Supersedes**: [ADR-0001 — Hybrid SDK + CLI runtime](0001-hybrid-runtime.md)

## Context

v0.5 used `@github/copilot-sdk` for short-lived agent calls and
`copilot --no-interactive` for long-running ones. The SDK wrapped a
`SpecFleetSession` class with token gates, audit logging, secret
redaction, and a permission gate. This worked but produced two parallel
implementations of every feature (one for the SDK path, one for the CLI
path), and the SDK's surface kept moving — every minor bump required a
patch in our wrapper.

The Spec-Kit community calls (Brady Gaster + collaborators) and
internal feedback converged on the same observation: the *interesting*
parts of agent orchestration — sub-agent spawning, model routing,
tool gating, MCP wiring — are now first-class features of Copilot CLI
itself.

## Decision

SpecFleet v0.6 owns **only**:

1. The eight-phase Spec-Kit pipeline (`specify` … `checklist`).
2. The shape of artefacts on disk under `.specfleet/specs/<id>/`.
3. The shared scratchpad MCP server.
4. Charter mirroring into `.github/agents/`.
5. Cross-model review (calling Copilot CLI with a different `--model`).

Everything else is delegated to Copilot CLI:

| Concern | Owned by |
|---|---|
| Subagent spawning | Copilot CLI |
| Model selection | Copilot CLI (we just pass `--model`) |
| Tool gating | Copilot CLI (we just pass `--allow-tool`) |
| MCP servers | Copilot CLI (we just point at the manifest) |
| Auth / token refresh | Copilot CLI |
| Streaming output | Copilot CLI |
| Auditability | git history of `.specfleet/specs/**` + `.specfleet/runs/*.jsonl` |

We dropped the `@github/copilot-sdk` dependency entirely. There is now a
single `dispatch()` function (`src/runtime/dispatch.ts`) that spawns
`copilot -p -` with whatever flags a phase needs.

## Consequences

**Positive:**

- Lean dependency tree (no SDK pin to chase).
- One code path per feature.
- Zero runtime enforcement to keep up with Copilot CLI feature drift.
- Easy to mock for tests via `SPECFLEET_COPILOT_BINARY`.
- Lower onboarding cost — install Copilot CLI, install SpecFleet, done.

**Negative:**

- We can no longer enforce the tool allowlist at the SpecFleet layer.
  The user must trust Copilot CLI's tool-confirmation flow.
- We lost the hash-chained audit log. PRs + git history must do that
  job, which is fine for our threat model but worse for high-assurance
  environments.
- Copilot CLI must be installed and authenticated. We probe for it on
  `init` and `check` and fail loudly if missing.

## Alternatives considered

1. **Stay on SDK + CLI hybrid.** Rejected — duplicate code, ongoing
   maintenance tax.
2. **Drop CLI, SDK-only.** Rejected — the SDK is still maturing and
   doesn't yet support every Copilot CLI feature we depend on.
3. **Build our own model router.** Rejected — out of scope for a
   spec-driven pipeline tool.
