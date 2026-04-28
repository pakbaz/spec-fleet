# ADR-0002: Token budget — pre-flight estimation + SDK infinite sessions

## Status
Accepted (MVP).

## Context
Coding agents have a ~128K token ceiling. To stay safely under, we want a
**per-charter cap** (default 80K, hard cap 95K) that the runtime enforces,
*and* an automatic compaction strategy for long-running work.

## Decision
1. **Charter-declared cap** — every `*.charter.md` declares `maxContextTokens`.
   `EasSession.ask()` performs a pre-flight estimate (`chars / 4` heuristic,
   override via `EAS_TOKEN_RATIO`) and throws `TokenBudgetExceededError` at the
   cap.
2. **Infinite sessions** — we enable the SDK's
   `infiniteSessions: { enabled: true }` so the SDK auto-summarizes long
   sessions. We accept that this is a black box and complement it with our own
   `.eas/checkpoints/<agent>-<n>.md` for **cross-agent** memory.
3. **Subagent isolation** — every delegation runs in a *fresh* session with
   only the brief + the subagent's charter + lazy skills in context. There is
   no shared parent context.

## Consequences
+ Hard upper bound on per-prompt size.
+ No tiktoken dependency at runtime.
- Heuristic is approximate (±25%); we add 5K headroom under 95K.
- The SDK's compaction is opaque; we mitigate with our own decisions/checkpoints.
