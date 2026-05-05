---
spec_id: origin-allowlist
phase: review
status: approved
created: 2026-05-04
reviewer_model: gpt-5.1
implement_model: claude-sonnet-4.5
---

# Review — origin-allowlist

Cross-model review. Implementation by `claude-sonnet-4.5`; review by
`gpt-5.1` per `.specfleet/config.json`. Anti-bias mechanic (ADR-0005).

## Files touched

- [`internal/dashboard/handler.go`](../../../internal/dashboard/handler.go) — replaced exact-string match with `OriginAllowed`; added unexported helpers `originsMatch`, `splitHostPort`, `hostsEquivalent`.
- [`internal/dashboard/handler_test.go`](../../../internal/dashboard/handler_test.go) — added table-driven `TestOriginAllowedTreatsLocalhostAnd127AsEquivalent` covering 7 cases.

## Review against the spec

| Req | Verdict | Evidence |
|-----|---------|----------|
| R1 (loopback equivalence: localhost ↔ 127.0.0.1 ↔ [::1]) | ✅ | `hostsEquivalent` map covers all three. |
| R2 (case-insensitive host) | ✅ | `splitHostPort` lowercases the host portion before comparison. |
| R3 (scheme strict) | ✅ | `originsMatch` checks scheme equality before any host work. |
| R4 (port strict) | ✅ | `originsMatch` rejects on port mismatch before checking hosts. |
| R5 (empty Origin allowed) | ✅ | `OriginAllowed` early-returns `true` when `origin == ""`. |
| R6 (no external deps) | ✅ | `go.sum` does not exist; only `net/url` and `strings` from stdlib used. |

## Architect notes (reviewer charter)

- **Style:** matches the surrounding package; helpers are correctly
  unexported and lowercased.
- **Test design:** table-driven, easy to extend if R1 ever needs to grow
  to cover more IPv6 forms.
- **Performance:** the allow-list is parsed on every call. For a demo
  this is fine; if upstream traffic grows, parse once at construction.
  Filed as a low-severity observation; out of scope for this spec.

## Outstanding items

- None blocking. The "parse-once" observation above is recorded for a
  future performance pass.

## Verdict

**Approved.** Proceed to checklist.
