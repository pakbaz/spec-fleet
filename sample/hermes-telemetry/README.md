# Hermes telemetry — SpecFleet brownfield demo

A small Go service that fakes telemetry events and serves a read-only
HTML dashboard. It is intentionally **brownfield** — it pre-exists the
SpecFleet workspace and was *adopted* into SpecFleet rather than built
under it.

> Inspired by, but not a fork of, the
> [`spec-kit-go-brownfield-demo`](https://github.com/mnriem/spec-kit-go-brownfield-demo)
> pattern. All code here is original.

## What this sample shows

1. How to onboard an existing Go codebase with `specfleet init --mode brownfield`.
2. How a v0.6 spec captures a real fix on top of pre-existing code.
3. The full 8-phase pipeline (specify → clarify → plan → tasks → analyze →
   implement → review → checklist) for one feature: `origin-allowlist`.

## Running it

```bash
cd sample/hermes-telemetry
make test          # go test ./...
make run           # starts dashboard on :8080
# open http://localhost:8080 — same-origin fetches /api/events
# or http://127.0.0.1:8080 — both work after the origin-allowlist fix
```

## Layout

```text
cmd/hermesd/                 # entry point
internal/telemetry/          # ring buffer + synthetic generator
internal/dashboard/          # http.Handler + origin allow-list
.specfleet/                  # SpecFleet workspace
  instruction.md             # constitution (5 rules, derived from code)
  project.md                 # project cheat sheet (brownfield mode)
  config.json                # default + reviewer models
  charters/                  # 7 flat charters, mirrored to .github/agents/
  specs/origin-allowlist/    # the one finished spec — all 7 phase files
  scratchpad/origin-allowlist.md
  runs/origin-allowlist.log.md
.github/                     # generated mirror of the runtime contract
go.mod                       # stdlib only — no go.sum
Makefile
```

## The `origin-allowlist` spec

The original code did exact-string matching on the `Origin` header against
a comma-separated allow-list. That broke local development because
`http://localhost:8080` and `http://127.0.0.1:8080` are not the same
string even though they're the same machine. The spec walks through:

| Phase | File |
|-------|------|
| specify | [`spec.md`](.specfleet/specs/origin-allowlist/spec.md) |
| clarify | [`clarifications.md`](.specfleet/specs/origin-allowlist/clarifications.md) |
| plan | [`plan.md`](.specfleet/specs/origin-allowlist/plan.md) |
| tasks | [`tasks.md`](.specfleet/specs/origin-allowlist/tasks.md) |
| analyze | [`analysis.md`](.specfleet/specs/origin-allowlist/analysis.md) |
| review | [`review.md`](.specfleet/specs/origin-allowlist/review.md) |
| checklist | [`checklist.md`](.specfleet/specs/origin-allowlist/checklist.md) |

Plus the working memory and run transcript:

- [`scratchpad/origin-allowlist.md`](.specfleet/scratchpad/origin-allowlist.md)
- [`runs/origin-allowlist.log.md`](.specfleet/runs/origin-allowlist.log.md)

The fix itself lives in
[`internal/dashboard/handler.go`](internal/dashboard/handler.go) under
`OriginAllowed` and is exercised by the table-driven test
[`TestOriginAllowedTreatsLocalhostAnd127AsEquivalent`](internal/dashboard/handler_test.go).

## Constitution highlights

From [`.specfleet/instruction.md`](.specfleet/instruction.md):

1. **Stdlib-only.** No `require` block in `go.mod`; no `go.sum`.
2. **Read-only by default.** No mutating endpoints.
3. **Boring HTTP.** Polling, no websockets/SSE.
4. **Loopback first.** `localhost` and `127.0.0.1` are equivalent.
5. **Synthetic data is honest.** Clearly labelled.

## Try the pipeline yourself

To re-run the SpecFleet pipeline on a brand-new feature against this
codebase:

```bash
cd sample/hermes-telemetry
specfleet specify "rate-limit /api/events to 60 req/min per IP"
specfleet clarify --spec rate-limit
specfleet plan     --spec rate-limit
specfleet tasks    --spec rate-limit
specfleet analyze  --spec rate-limit
specfleet implement --spec rate-limit
specfleet review   --spec rate-limit
specfleet checklist --spec rate-limit
```

Each phase invokes the appropriate charter through the Copilot CLI; the
artefacts land in `.specfleet/specs/rate-limit/`.

## Out of scope for this demo

- Real upstream telemetry adapters
- Authentication on the dashboard
- Persistent storage of events
- Multi-tenant isolation

These are documented in
[`.specfleet/project.md`](.specfleet/project.md#out-of-scope-for-the-demo).
