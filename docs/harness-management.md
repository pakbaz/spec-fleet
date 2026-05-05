# Harness Management

> **Deprecated for v0.6.** The `eval` / `tune` / scoreboard pipeline
> described here was a v0.5 feature. v0.6 dropped it as part of the
> simplification (see [migration-from-0.5.md](migration-from-0.5.md) and
> [adr/0004-thin-shim.md](adr/0004-thin-shim.md)).
>
> This file is kept for historical reference. If you need a regression
> harness for charter behaviour today, run a small set of golden specs
> through the eight-phase pipeline in CI and assert on the artefact
> shape (`spec.md`, `plan.md`, `tasks.md`, etc.). A worked example
> belongs in a future ADR — open an issue if you'd like to drive it.

## What v0.5 did

- `templates/benchmarks/<charter>.bench.md` declared expectations.
- `specfleet check --eval` ran each benchmark and wrote a JSONL
  scoreboard.
- `specfleet check --tune` produced an advisory diff against the live
  charter that humans reviewed in PR.

## What v0.6 does instead

Nothing built-in. Drift control comes from:

1. **`specfleet check`** — validates schema, mirror parity, prompt
   presence, MCP readiness. This catches *structural* drift.
2. **Cross-model review** (Phase 7) — catches semantic drift on a
   per-spec basis.
3. **Git history of `.specfleet/specs/<id>/`** — every artefact is on
   disk, reviewed in PR. Behavioural drift is visible in the review.

If you need closed-loop tuning (i.e. "the charter rewrote itself based
on benchmark scores"), build it as a separate npm package that consumes
`.specfleet/runs/*.jsonl` and emits charter PRs. v0.6 deliberately
keeps that out of the core.
