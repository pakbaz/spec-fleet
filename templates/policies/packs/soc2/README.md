# SOC 2 Starter Pack

> Source: AICPA Trust Services Criteria (TSC) for Security, Availability,
> Processing Integrity, Confidentiality, and Privacy — 2017 framework with
> 2022 points of focus.
>
> **Disclaimer.** Starter pack only — tune to your compliance program. Control
> mappings here are paraphrased and meant as a believable starting point, not
> auditor-grade evidence.

## What this pack covers

A pragmatic baseline for the **Common Criteria (CC) Security** category that
is exercised most often by SpecFleet agents: logical access, transmission of
sensitive data, change management, and monitoring.

## Control → SpecFleet hook mapping

| Control | Name                                                | SpecFleet hooks                                            |
|---------|-----------------------------------------------------|------------------------------------------------------|
| CC6.1   | Logical and physical access controls                | `egress-allowlist`, `ip-guard`, `secret-redaction`   |
| CC6.6   | Restrict transmission of sensitive information      | `egress-allowlist`, `ip-guard`                       |
| CC6.7   | Restrict information movement to authorized users   | `egress-allowlist`, `secret-redaction`               |
| CC7.2   | Monitor system components for anomalies             | `audit-hashchain`                                    |
| CC7.3   | Evaluate security events                            | `audit-hashchain`, `ip-guard`                        |
| CC8.1   | Authorize, design, develop, implement changes       | `pre-commit-scan`, `audit-hashchain`                 |

## Defaults shipped

- `egress.json` — `mode: redact`, default-deny with an allow list for GitHub,
  npm/PyPI, and common Azure endpoints.
- `ip-guard.json` — `mode: redact`, patterns for cloud keys, PEM blocks,
  bearer tokens, and JWTs.

## How to enable

```bash
specfleet init --with-pack soc2
```

This copies the pack contents into `.specfleet/policies/` and merges the control
list into your `.specfleet/instruction.md` compliance scope.
