---
spec_id: origin-allowlist
phase: checklist
status: passed
created: 2026-05-04
---

# Checklist — origin-allowlist

Final acceptance gate. Each requirement maps to a real file:line in the
implementation and the test suite.

## Requirement coverage

| Req | Description | Implementation evidence | Test evidence | Status |
|-----|-------------|------------------------|----------------|--------|
| R1 | Loopback equivalence (localhost ↔ 127.0.0.1 ↔ [::1]) | [`internal/dashboard/handler.go` `hostsEquivalent`](../../../internal/dashboard/handler.go#L113-L119) | [`handler_test.go`](../../../internal/dashboard/handler_test.go#L57-L82) cases 1, 2, 6 | ✅ |
| R2 | Case-insensitive host | [`splitHostPort` `strings.ToLower`](../../../internal/dashboard/handler.go#L106-L112) | [`handler_test.go`](../../../internal/dashboard/handler_test.go#L57-L82) case 6 | ✅ |
| R3 | Strict scheme matching | [`originsMatch` `EqualFold(Scheme)`](../../../internal/dashboard/handler.go#L94-L97) | [`handler_test.go`](../../../internal/dashboard/handler_test.go#L57-L82) case 4 | ✅ |
| R4 | Strict port matching | [`originsMatch` port check](../../../internal/dashboard/handler.go#L98-L102) | [`handler_test.go`](../../../internal/dashboard/handler_test.go#L57-L82) case 3 | ✅ |
| R5 | Empty Origin allowed | [`OriginAllowed` early-return](../../../internal/dashboard/handler.go#L77-L79) | [`handler_test.go`](../../../internal/dashboard/handler_test.go#L57-L82) case 7 | ✅ |
| R6 | No external Go dependencies | [`go.mod`](../../../go.mod) — no `require` block; `go.sum` does not exist | `go test ./...` reports `[no dependencies]` | ✅ |

## Regression checks

- ✅ Existing `TestServeEventsRejectsForbiddenOrigin` still passes (verifies an unrelated host is still 403).
- ✅ Existing `TestServeIndexReturnsHTML` still passes.
- ✅ Existing `TestUnknownPathIs404` still passes.

## Quality gates

| Gate | Command | Result |
|------|---------|--------|
| Vet | `go vet ./...` | clean |
| Tests | `go test ./...` | 7 tests in `internal/dashboard`, 2 in `internal/telemetry`, all pass |
| Stdlib only | `ls go.sum` | "No such file" — passes |

## Verdict

**PASSED.** Spec ready to merge.
