# HIPAA — SpecFleet Coverage

The U.S. **Health Insurance Portability and Accountability Act (HIPAA)
Security Rule** (45 CFR Part 164, Subpart C) sets administrative, physical,
and technical safeguards for electronic Protected Health Information
(ePHI). SpecFleet focuses on the technical safeguards in §164.312 and a subset of
administrative safeguards in §164.308 that AI agents directly affect. The
HIPAA pack ships in **block mode** — violations halt the operation rather
than redacting it.

## Coverage matrix

| Control          | Control name                       | SpecFleet hook                                  | Coverage notes                                                                       |
|------------------|------------------------------------|-------------------------------------------|--------------------------------------------------------------------------------------|
| 164.308(a)(1)    | Security management process        | `audit-hashchain`, `pre-commit-scan`      | Audit chain supports risk analysis and review; pre-commit gate enforces sanctions.   |
| 164.308(a)(4)    | Information access management      | `egress-allowlist`, `ip-guard`            | Default-deny egress + PHI pattern detection enforce minimum-necessary access.        |
| 164.312(a)(1)    | Access control                     | `egress-allowlist`, `secret-redaction`    | Only BAA-covered endpoints reachable; credentials never echoed back.                 |
| 164.312(b)       | Audit controls                     | `audit-hashchain`                         | Hash-chained, append-only event log.                                                 |
| 164.312(c)(1)    | Integrity                          | `audit-hashchain`                         | Cryptographic linkage detects retroactive tampering.                                 |
| 164.312(e)(1)    | Transmission security              | `egress-allowlist`, `ip-guard`            | TLS enforced upstream; PHI patterns blocked from leaving the boundary.               |

## How to enable

```bash
specfleet init --with-pack hipaa
```

After enabling, edit `.specfleet/policies/packs/hipaa/egress.json` and add only
endpoints covered by an executed Business Associate Agreement (BAA).

## Disclaimer

Starter pack only — tune to your compliance program. HIPAA compliance also
requires BAAs, workforce training, breach-notification procedures, and a
documented risk analysis. This pack does not replace any of them.
