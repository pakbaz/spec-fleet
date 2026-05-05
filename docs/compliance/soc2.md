# SOC 2 — SpecFleet Coverage

<!-- markdownlint-disable MD060 -->
> **v0.6 status — historical reference.** The compliance "packs"
> (`specfleet init --with-pack <name>`) and the audit hash-chain
> primitive referenced below were v0.5 features. v0.6 dropped both as
> part of the simplification (see
> [migration-from-0.5.md](../migration-from-0.5.md)). Map your SOC 2
> controls onto the v0.6 primitives — committed charters, cross-model
> review, `specfleet check`, and git history of `.specfleet/specs/`.
> A refreshed coverage matrix is tracked in a future release.

The American Institute of Certified Public Accountants (AICPA) **SOC 2**
report attests to a service organization's controls relevant to the Trust
Services Criteria (TSC): Security, Availability, Processing Integrity,
Confidentiality, and Privacy. The SpecFleet SOC 2 starter pack focuses on the
Common Criteria (CC) Security category, which is the only category required
for every SOC 2 engagement.

## Coverage matrix

| Control | Control name                                          | SpecFleet hook                                            | Coverage notes                                                                         |
|---------|-------------------------------------------------------|-----------------------------------------------------|----------------------------------------------------------------------------------------|
| CC6.1   | Logical and physical access controls                  | `egress-allowlist`, `ip-guard`, `secret-redaction`  | Default-deny egress + secret/PII redaction enforce least-privilege at the agent edge.  |
| CC6.6   | Restrict transmission of sensitive information        | `egress-allowlist`, `ip-guard`                      | Outbound traffic restricted to the allow list; sensitive payloads scrubbed.            |
| CC6.7   | Restrict information movement                         | `egress-allowlist`, `secret-redaction`              | Prevents agents from exfiltrating credentials or copying data to unapproved sinks.     |
| CC7.2   | Monitor system components for anomalies               | `audit-hashchain`                                   | Tamper-evident audit log feeds anomaly detection.                                      |
| CC7.3   | Evaluate security events                              | `audit-hashchain`, `ip-guard`                       | Hash-chained events plus DLP findings give investigators a defensible timeline.        |
| CC8.1   | Authorize, design, develop, implement changes         | `pre-commit-scan`, `audit-hashchain`                | Pre-commit scan blocks risky changes; audit chain attests to the change record.        |

## v0.5 pack behavior

In v0.5, `specfleet init --with-pack soc2` wrote `egress.json`,
`ip-guard.json`, and `pack.json` under a SOC 2 policy pack and registered
controls in `.specfleet/instruction.md`. In v0.6 there is no pack installer;
keep SOC 2 invariants in the constitution and verify evidence with the
checklist phase.

## Disclaimer

Starter pack only — tune to your compliance program. SpecFleet hooks are technical
controls; SOC 2 also requires policies, vendor management, risk assessment,
and HR controls that live outside this repository.
