---
feature: origin-allowlist
role: devsecops
status: active
created: 2026-05-04
---

# Charter — origin-allowlist (devsecops)

## Goal
Treat `localhost` and `127.0.0.1` as equivalent loopback origins in the dashboard's
`--allowed-origins` allow-list, without widening the allow-list to any other host.

## Inputs
- `specs/origin-allowlist/spec.md`, `plan.md`, `tasks.md`
- The Hermes constitution (`.specfleet/instruction.md`) and project cheat sheet
- Existing origin matching in `internal/dashboard/`

## Output
A reviewed change that canonicalizes loopback hosts during origin comparison, plus tests
covering both loopback spellings and a negative case for a non-loopback host.

## Constraints
- Stdlib only — no new dependencies.
- Do not broaden CORS beyond explicit loopback equivalence; non-allow-listed origins still 403.
- Stay in the devsecops role: security-relevant comparison only.

## Notes
- This is the brownfield sample's first feature, adopted via `init --mode brownfield`.
