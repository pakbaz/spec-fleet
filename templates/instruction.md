---
version: "0.1.0"
organization: "Your Org"
effectiveDate: "YYYY-MM-DD"
owners:
  - "you@example.com"
---

# Constitution

The non-negotiable rules every SpecFleet phase honours. Keep this short — the
goal is rules every contributor can read in 60 seconds.

## Principles
- Smallest change that satisfies the spec wins.
- Reversible decisions over heroic ones.
- Evidence over trust: every requirement ends up cited in the checklist.

## Coding
- Match the existing style and idioms of the file you are editing.
- Public APIs document data classification (PII / PCI / PHI / public).

## Security
- Never commit secrets. Use the team's secret store.
- Authenticate every endpoint unless explicitly marked public in `plan.md`.

## Compliance
- PII is encrypted at rest and never logged.
- Audit-relevant changes include spec id + run id in their log lines.

## Operations
- Every service exposes liveness + readiness probes.
- Every deploy has a documented rollback path.

## Approved runtimes
- (list the runtimes / languages / frameworks your team has agreed to maintain)

## Forbidden
- (list patterns the team has explicitly outlawed; e.g. `eval`, `child_process` with shell strings)

## Contacts
- security: ...
- compliance: ...
