---
spec_id: origin-allowlist
phase: clarify
status: resolved
created: 2026-05-04
---

# Clarifications — origin-allowlist

The `specify` phase surfaced four open questions. All resolved before
planning.

## Q1. Which loopback aliases should be considered equivalent?

**Decision:** `localhost`, `127.0.0.1`, and `[::1]`. Other IPv6 loopback
forms (`[::ffff:127.0.0.1]`, etc.) are deferred — they don't appear in
the dev-loop scenarios that motivated the spec.

## Q2. What about loopback hosts with different ports?

**Decision:** still rejected. Equivalence is per-host, not per-(host+port).
A dashboard configured for `:8080` should not accept requests claiming to
come from `:9090` even on the same machine.

## Q3. Should we relax scheme matching too?

**Decision:** No. `http` ≠ `https` stays strict. If someone is running the
dashboard over TLS in dev, that's intentional.

## Q4. Same-origin (empty Origin) — allow or deny?

**Decision:** Allow. The dashboard JS uses `credentials: 'same-origin'`
which can omit the `Origin` header on same-origin requests in some
configurations. Denying empty would break the dashboard from itself.

## Confirmed assumptions

- The codebase has no test infrastructure for live HTTP — all handler
  tests use `httptest`. Verified in `internal/dashboard/handler_test.go`.
- The `--allowed-origins` flag is parsed by `strings.Split(",", …)` in
  `cmd/hermesd/main.go`. No structural changes to flag parsing.
- The constitution rule "stdlib only" remains in force — `net/url` and
  `strings` from the stdlib are sufficient.
