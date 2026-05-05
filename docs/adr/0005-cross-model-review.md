# ADR-0005: Cross-model review by default

- **Status**: Accepted (v0.6)
- **Date**: 2026-05-01

## Context

The Spec-Kit pipeline ends with a `review` phase. In v0.5 review reused
the implementation model. The Spec-Kit community calls and our own
internal evals showed the same pattern: when a model reviews its own
output, it tends to confirm the structure it just wrote. The reviewer
needs to be a *different* model to catch the implementer's blind spots.

## Decision

SpecFleet ships a `.specfleet/config.json` with two model slots:

```json
{
  "models": {
    "default": "claude-sonnet-4.5",
    "review": "gpt-5.1"
  }
}
```

`specfleet review <spec-id>` uses `models.review` automatically. To
disable cross-model review for a single call, pass `--same-model`. To
override the review model for a single call, set
`SPECFLEET_REVIEW_MODEL` in the environment or use `--model`.

The pair is intentionally **a Claude default + a GPT review** so that
*by default* the implementer and reviewer come from different vendors.
Users who only have one vendor available can override one slot in
`config.json` and accept the same-vendor review trade-off.

## Consequences

**Positive:**

- Reviewer is from a different vendor by default — catches one whole
  class of "the model just wrote what felt right" bugs.
- Configurable per-workspace; users with single-vendor access can opt
  out without code changes.

**Negative:**

- Costs ~2× as much per spec because we run the review with a separate
  model on top of the implementation run.
- Requires the user to have access to both vendors via their Copilot
  plan. Users on single-vendor plans must explicitly set both slots to
  the same model.

## Alternatives considered

1. **Same-model review.** Rejected — the whole reason to add the phase
   is to break the implementer's framing.
2. **Hard-code the pair.** Rejected — users may not have access to both
   vendors. Configurable defaults strike the balance.
3. **Run review *N* times with different models and aggregate.** Rejected
   — too expensive for the marginal gain.
