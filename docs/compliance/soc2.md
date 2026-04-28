# SOC 2 — EAS Coverage

The American Institute of Certified Public Accountants (AICPA) **SOC 2**
report attests to a service organization's controls relevant to the Trust
Services Criteria (TSC): Security, Availability, Processing Integrity,
Confidentiality, and Privacy. The EAS SOC 2 starter pack focuses on the
Common Criteria (CC) Security category, which is the only category required
for every SOC 2 engagement.

## Coverage matrix

| Control | Control name                                          | EAS hook                                            | Coverage notes                                                                         |
|---------|-------------------------------------------------------|-----------------------------------------------------|----------------------------------------------------------------------------------------|
| CC6.1   | Logical and physical access controls                  | `egress-allowlist`, `ip-guard`, `secret-redaction`  | Default-deny egress + secret/PII redaction enforce least-privilege at the agent edge.  |
| CC6.6   | Restrict transmission of sensitive information        | `egress-allowlist`, `ip-guard`                      | Outbound traffic restricted to the allow list; sensitive payloads scrubbed.            |
| CC6.7   | Restrict information movement                         | `egress-allowlist`, `secret-redaction`              | Prevents agents from exfiltrating credentials or copying data to unapproved sinks.     |
| CC7.2   | Monitor system components for anomalies               | `audit-hashchain`                                   | Tamper-evident audit log feeds anomaly detection.                                      |
| CC7.3   | Evaluate security events                              | `audit-hashchain`, `ip-guard`                       | Hash-chained events plus DLP findings give investigators a defensible timeline.        |
| CC8.1   | Authorize, design, develop, implement changes         | `pre-commit-scan`, `audit-hashchain`                | Pre-commit scan blocks risky changes; audit chain attests to the change record.        |

## How to enable

```bash
eas init --with-pack soc2
```

The pack writes `egress.json`, `ip-guard.json`, and `pack.json` under
`.eas/policies/packs/soc2/` and registers the controls in
`.eas/instruction.md` under `policies.compliance`.

## Disclaimer

Starter pack only — tune to your compliance program. EAS hooks are technical
controls; SOC 2 also requires policies, vendor management, risk assessment,
and HR controls that live outside this repository.
