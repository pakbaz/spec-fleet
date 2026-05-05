# ADR-0002: Token budget pre-flight estimation

## Status

Accepted with v0.6 revisions.

## Context

Copilot CLI has a large but finite context window. SpecFleet still needs a
cheap guardrail before dispatch so a phase does not fail after the user has
already waited on model execution.

v0.5 paired this budget gate with SDK infinite sessions and checkpoint files.
v0.6 dropped the SDK path entirely (see [ADR-0004](0004-thin-shim.md)), so the
budget decision is now narrower: estimate the rendered prompt and fail early if
it exceeds the owning charter's cap.

## Decision

1. Every charter declares `maxContextTokens`; the default is **60,000** and the
   schema hard ceiling is **95,000**.
2. `runPhase()` estimates the rendered prompt with the local `chars / 4`
   heuristic before calling `dispatch()`; `SPECFLEET_TOKEN_RATIO` can tune the
   divisor for unusual content.
3. If the estimate exceeds the charter cap, the phase aborts with an actionable
   error asking the user to trim input or split the work.
4. If the estimate exceeds 80 percent of the cap, the phase emits a warning but
   still runs.
5. Shared working memory is explicit markdown at `.specfleet/scratchpad/<id>.md`,
   not hidden SDK compaction or checkpoint files.

## Consequences

- Hard upper bound on per-prompt size.
- No tokenizer dependency at runtime.
- Budget behavior is predictable and easy to test.
- The heuristic is approximate; users may still hit model-side limits on unusual
  content.
- Long-running context management is delegated to Copilot CLI and the shared
  scratchpad rather than owned by SpecFleet.
