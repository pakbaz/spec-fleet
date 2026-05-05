---
constitution: hermes-telemetry
version: 1.0.0
---

# Hermes telemetry — constitution

This is the brownfield constitution for the Hermes telemetry sample. It
was derived (in the spirit of `speckit.constitution`) from the existing
codebase rather than authored up-front, then trimmed to the rules that
actually have teeth.

## Principles

1. **Stdlib-only.** No external Go modules. Every new feature must justify
   itself against this rule before any import is added. The CI assertion
   `go.sum` does not exist captures this today.
2. **Read-only by default.** The dashboard never mutates server state. New
   endpoints that mutate state require explicit opt-in via a flag.
3. **Boring HTTP.** No websockets, no SSE, no long-polling. The dashboard
   refreshes by polling `/api/events` once per second. Simple beats clever.
4. **Loopback first.** Local development with `localhost` and `127.0.0.1`
   must work interchangeably without operator config gymnastics.
5. **Synthetic data is honest.** The synthetic generator produces values
   that look telemetry-shaped but is clearly labelled synthetic in the
   dashboard.

## Operational invariants

- All goroutines must respect context cancellation; no orphan workers on
  shutdown.
- All HTTP handlers must be tested with `httptest.NewRecorder` — no live
  port bindings in tests.
- All time values are UTC at the wire boundary; local-time conversion is
  the dashboard's concern.

## Security invariants

- The Origin allow-list is the only access control. It is exact-host /
  loopback-equivalence today and that is enough for the demo.
- No filesystem writes from any HTTP handler.
- The synthetic generator must not be wired up to any process the operator
  did not explicitly request.

## Style

- `gofmt` clean; `go vet` clean.
- Test names follow the pattern `Test<Subject><Behaviour>`.
- Public symbols carry doc comments; internal package symbols may omit
  them when the name is sufficient.

## Out of scope

- Real telemetry adapters, persistent storage, multi-tenant isolation —
  those are documented in `.specfleet/project.md` under "out of scope".
