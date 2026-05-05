---
name: "Hermes Telemetry"
mode: "brownfield"
description: "Lightweight Go ground-support telemetry server with a read-only HTML dashboard. Inspired by NASA's Hermes; not a fork."
primaryLanguage: "go"
runtime: "go1.22"
frameworks:
  - "net/http"
dataStores:
  - "in-memory ring buffer"
integrations: []
deploymentTargets:
  - "single binary"
nfr:
  availabilityTier: "best-effort"
  performanceP99Ms: 50
  securityTier: "standard"
complianceScope: []
notes: "Brownfield demo. The codebase pre-dates SpecFleet; the first feature added under SpecFleet (origin-allowlist) hardens the dashboard's CORS handling."
---

# Hermes telemetry — project cheat sheet

A pre-existing Go service that exposes a JSON event stream (`/api/events`)
and a static HTML dashboard. Used as a brownfield fixture to demonstrate
how SpecFleet onboards an existing codebase.

## Stack

- **Language:** Go 1.22 (stdlib-only on purpose — no external deps)
- **Runtime:** single binary, listens on `:8080` by default
- **Framework:** `net/http`
- **Build / test:** `go build`, `go test`, `make test`

## Layout

```text
cmd/hermesd/          # entry point — wires synthetic source + dashboard
internal/telemetry/   # event buffer + synthetic generator
internal/dashboard/   # HTTP handler + origin allow-list
.specfleet/           # SpecFleet workspace (added during onboarding)
.github/              # mirror of the runtime contract
Makefile              # build / test / vet / run
```

## Integrations

- None. The service is self-contained; the synthetic generator stands in
  for upstream telemetry until a real source is wired up.

## Quality bars

- Test command: `go test ./...`
- Vet command: `go vet ./...`
- Coverage minimum: not enforced (brownfield baseline)
- Required-dependencies policy: stdlib only

## Deploy

- Pipeline: not yet automated; `make build` produces `bin/hermesd`.
- Environments: developer laptop only for the demo.
- Rollback: redeploy the prior binary.

## Compliance scope

- Data classes handled: synthetic telemetry; no PII, no PHI, no PCI data.

## Known issues at onboarding time

- The dashboard origin allow-list does exact string match, so
  `http://localhost:8080` and `http://127.0.0.1:8080` are not treated as
  equivalent (see spec `origin-allowlist`).
- No rate limiting on `/api/events`.
- No structured logging — `log.Printf` only.

## Out of scope (for the demo)

- Real upstream telemetry adapters (gRPC, MQTT).
- Authentication on the dashboard.
- Persistent storage of events.
