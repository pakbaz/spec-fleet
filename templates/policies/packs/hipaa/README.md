# HIPAA Starter Pack

> Source: HIPAA Security Rule, 45 CFR Part 164 Subpart C (technical and
> administrative safeguards for electronic Protected Health Information).
>
> **Disclaimer.** Starter pack only — tune to your compliance program. This
> pack does not constitute a Business Associate Agreement (BAA), risk
> analysis, or breach-notification procedure. Engage your privacy and
> compliance officers before processing real PHI.

## What this pack covers

A strict baseline for environments that may handle electronic Protected
Health Information (ePHI). The pack ships in **block mode** — violations halt
the agent action rather than redact it — and uses **default-deny egress**.

## Control → SpecFleet hook mapping

| Control          | Name                              | SpecFleet hooks                                  |
|------------------|-----------------------------------|--------------------------------------------|
| 164.308(a)(1)    | Security management process       | `audit-hashchain`, `pre-commit-scan`       |
| 164.308(a)(4)    | Information access management     | `egress-allowlist`, `ip-guard`             |
| 164.312(a)(1)    | Access control                    | `egress-allowlist`, `secret-redaction`     |
| 164.312(b)       | Audit controls                    | `audit-hashchain`                          |
| 164.312(c)(1)    | Integrity                         | `audit-hashchain`                          |
| 164.312(e)(1)    | Transmission security             | `egress-allowlist`, `ip-guard`             |

## Defaults shipped

- `egress.json` — `mode: block`, `default: deny`, allow list **empty**. You
  must explicitly add BAA-covered endpoints.
- `ip-guard.json` — `mode: block`, patterns for SSN, MRN, DOB, ICD-10, NPI,
  phone, and email — the most common HIPAA Safe Harbor identifiers.

## How to enable

```bash
specfleet init --with-pack hipaa
```

After enabling, review `.specfleet/policies/egress.json` and add the FQDNs of the
BAA-covered services (e.g. specific Azure private endpoints) your workload
needs.
