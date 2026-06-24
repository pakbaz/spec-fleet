---
spec_id: origin-allowlist
phase: plan
status: approved
created: 2026-05-04
---

# Plan — origin-allowlist

## Architecture

- Single surface change: the `Handler.OriginAllowed(origin string) bool`
  method in `internal/dashboard/handler.go`. The HTTP handler itself
  already short-circuits on a `false` return, so no new branch in
  `serveEvents` is needed.
- Three small unexported helpers introduced inside the same package:
  `originsMatch(got, want *url.URL) bool`,
  `splitHostPort(hp) (host, port)`, and
  `hostsEquivalent(a, b string) bool`.
- No public API change; package consumers (currently only `cmd/hermesd`)
  are unaffected.

## Data

- No data model changes. The allow-list remains `[]string` populated from
  the `--allowed-origins` flag.

## Security

- The change strictly *expands* the set of accepted origins (loopback
  aliases) without expanding the host surface beyond loopback equivalence.
- Constitution rule 4 ("loopback first") is the explicit motivation.
- No new attack surface: the allow-list still rejects every non-loopback
  host that isn't an exact match.

## Operations

- The default allow-list value already contains both
  `http://localhost:8080` and `http://127.0.0.1:8080`, so behaviour for
  out-of-the-box `make run` is unchanged.
- No log emission added in this spec — captured separately in the future
  "structured logging" feature.

## Decisions

- **Use `net/url` for parsing.** Keeps the code stdlib-only and handles
  edge cases (invalid origins → reject) for free.
- **Treat empty `Origin` as allowed.** Validated against the dashboard's
  own fetch behaviour during clarify.
- **Loopback equivalence is hard-coded, not configurable.** Per the
  constitution it's a property of the local development experience, not
  a deployment knob.
