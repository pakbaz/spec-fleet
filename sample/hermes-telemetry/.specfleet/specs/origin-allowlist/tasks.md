---
spec_id: origin-allowlist
phase: tasks
status: complete
created: 2026-05-04
---

# Tasks — origin-allowlist

| # | Task | File(s) | Owner | Verify |
|---|---|---|---|---|
| 1 | Replace exact-string match with `OriginAllowed` using `net/url`. | `internal/dashboard/handler.go` | dev | `go test ./internal/dashboard` |
| 2 | Implement `originsMatch`, `splitHostPort`, `hostsEquivalent` helpers. | same | dev | unit tests for each scenario |
| 3 | Add a table-driven test covering all 7 cases from clarifications.md. | `internal/dashboard/handler_test.go` | test | `go test ./...` |
| 4 | Verify the existing 403-for-evil-origin test still passes (regression). | same | test | included in test run |
| 5 | Confirm zero new dependencies via `cat go.mod` (still no `require` block). | (repo) | architect | `go.sum` does not exist |

## Stop conditions

- Do **not** add `gorilla/mux`, `chi`, or any router. The handler stays a
  bare `http.Handler`.
- Do **not** widen the allow-list to non-loopback hosts.
- Do **not** introduce wildcards.

## Verification

```bash
cd sample/hermes-telemetry
go vet ./...
go test ./...
ls go.sum 2>/dev/null && echo "FAIL: external dep introduced" || echo "ok: stdlib only"
```
