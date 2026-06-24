---
id: origin-allowlist
title: Treat localhost and 127.0.0.1 as equivalent in the dashboard origin allow-list
status: done
created: 2026-05-04
---

# origin-allowlist

## Goal

When an operator configures the dashboard's `--allowed-origins` flag with
either `http://localhost:8080` or `http://127.0.0.1:8080`, the browser
should be able to fetch `/api/events` from *either* loopback origin
without a 403. Today only the exact-string match works, which surprises
every developer who runs `make run` for the first time.

## Background

The original codebase did exact-string comparison against the configured
allow-list. In a brownfield onboarding pass, the dev charter discovered
two issues with this:

1. The default value is `http://localhost:8080,http://127.0.0.1:8080`, so
   the bug only shows up when an operator narrows the list to one entry —
   a common production hardening step.
2. The allow-list is the dashboard's *only* access control today, so
   getting it right matters even though the data is read-only synthetic.

This spec is the first feature run through SpecFleet on this codebase and
deliberately stays narrow. A follow-up will tackle structured logging.

## Requirements

1. The dashboard MUST treat `localhost`, `127.0.0.1`, and `[::1]` as
   equivalent loopback hosts when comparing an incoming `Origin` to the
   configured allow-list.
2. Host comparison MUST be case-insensitive. `LocalHost` and `localhost`
   must match.
3. Scheme MUST match (`http` ≠ `https`).
4. Port MUST match exactly (`:8080` ≠ `:9090`).
5. An empty `Origin` header MUST be treated as same-origin and allowed
   (the dashboard fetches with `credentials: 'same-origin'`, which omits
   `Origin` for same-origin requests in some browser variants).
6. The fix MUST NOT add any external Go dependency (constitution rule 1).

## Out of scope

- Wildcards (`*.example.com`) — out of scope for this spec, may be a
  future feature once real upstream domains exist.
- Replacing the allow-list with token auth — separate spec, a much larger
  change.
- Logging the rejection reason — captured in the "structured logging"
  follow-up.

## Risks

- **Risk:** treating loopback hosts as equivalent could surprise a
  security reviewer expecting exact match. *Mitigation:* documented in
  `.specfleet/instruction.md` (rule 4) and the test matrix is explicit.
- **Risk:** IPv6 forms beyond `[::1]` (e.g. `[::ffff:127.0.0.1]`) are not
  handled. *Mitigation:* recorded in clarifications; not blocking for the
  loopback dev-loop case.
