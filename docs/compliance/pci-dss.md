# PCI DSS v4.0 — EAS Coverage

The **Payment Card Industry Data Security Standard (PCI DSS) v4.0**, issued
by the PCI Security Standards Council, specifies 12 high-level requirements
for any system that stores, processes, or transmits cardholder data. EAS
addresses the requirements that an AI agent can affect at runtime —
primarily data protection, transmission security, secure development, and
access control. The pack ships in **block mode** with a default-deny egress
posture.

## Coverage matrix

| Requirement | Name                                                                 | EAS hook                            | Coverage notes                                                                  |
|-------------|----------------------------------------------------------------------|-------------------------------------|---------------------------------------------------------------------------------|
| Req-3       | Protect stored account data                                          | `ip-guard`, `secret-redaction`      | PAN / CVV / track-data patterns blocked at the agent boundary.                  |
| Req-4       | Protect cardholder data with strong cryptography during transmission | `egress-allowlist`, `ip-guard`      | Only allow-listed, in-CDE endpoints reachable; PAN-shaped payloads blocked.     |
| Req-6       | Develop and maintain secure systems and software                     | `pre-commit-scan`                   | Blocks unsafe patterns and hard-coded credentials before commit.                |
| Req-7       | Restrict access by business need-to-know                             | `egress-allowlist`                  | Default-deny enforces least privilege at the network layer.                     |
| Req-8       | Identify users and authenticate access                               | `secret-redaction`                  | Prevents auth tokens from being echoed in logs or transcripts.                  |
| Req-10      | Log and monitor all access                                           | `audit-hashchain`                   | Tamper-evident log of every agent action affecting the CDE.                     |

## How to enable

```bash
eas init --with-pack pci-dss
```

The egress allow list ships **empty** — add only endpoints that have been
through CDE segmentation review with your QSA.

## Disclaimer

Starter pack only — tune to your compliance program. PCI DSS compliance is
established by a Report on Compliance (RoC) or Self-Assessment Questionnaire
(SAQ); these technical controls are necessary but not sufficient.
