# PCI DSS v4.0 — SpecFleet Coverage

<!-- markdownlint-disable MD060 -->

> **v0.6 status — historical reference.** Compliance packs
> (`specfleet init --with-pack <name>`) and the audit hash-chain
> primitive were v0.5 features and are gone in v0.6. See
> [migration-from-0.5.md](../migration-from-0.5.md). The v0.6
> implementation path is committed charters + cross-model review +
> `specfleet check` + git history.

The **Payment Card Industry Data Security Standard (PCI DSS) v4.0**, issued
by the PCI Security Standards Council, specifies 12 high-level requirements
for any system that stores, processes, or transmits cardholder data. SpecFleet
addresses the requirements that an AI agent can affect at runtime —
primarily data protection, transmission security, secure development, and
access control. The pack ships in **block mode** with a default-deny egress
posture.

## Coverage matrix

| Requirement | Name                                                                 | SpecFleet hook                            | Coverage notes                                                                  |
|-------------|----------------------------------------------------------------------|-------------------------------------|---------------------------------------------------------------------------------|
| Req-3       | Protect stored account data                                          | `ip-guard`, `secret-redaction`      | PAN / CVV / track-data patterns blocked at the agent boundary.                  |
| Req-4       | Protect cardholder data with strong cryptography during transmission | `egress-allowlist`, `ip-guard`      | Only allow-listed, in-CDE endpoints reachable; PAN-shaped payloads blocked.     |
| Req-6       | Develop and maintain secure systems and software                     | `pre-commit-scan`                   | Blocks unsafe patterns and hard-coded credentials before commit.                |
| Req-7       | Restrict access by business need-to-know                             | `egress-allowlist`                  | Default-deny enforces least privilege at the network layer.                     |
| Req-8       | Identify users and authenticate access                               | `secret-redaction`                  | Prevents auth tokens from being echoed in logs or transcripts.                  |
| Req-10      | Log and monitor all access                                           | `audit-hashchain`                   | Tamper-evident log of every agent action affecting the CDE.                     |

## v0.5 pack behavior

In v0.5, `specfleet init --with-pack pci-dss` created a PCI DSS policy pack
with an empty egress allowlist. In v0.6 there is no pack installer; keep the
CDE boundary in project docs, encode non-negotiable controls in
`.specfleet/instruction.md`, and require evidence in `checklist.md`.

## Disclaimer

Starter pack only — tune to your compliance program. PCI DSS compliance is
established by a Report on Compliance (RoC) or Self-Assessment Questionnaire
(SAQ); these technical controls are necessary but not sufficient.
