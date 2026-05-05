# GDPR — SpecFleet Coverage

<!-- markdownlint-disable MD060 -->

> **v0.6 status — historical reference.** Compliance packs
> (`specfleet init --with-pack <name>`) and the audit hash-chain
> primitive were v0.5 features and are gone in v0.6. See
> [migration-from-0.5.md](../migration-from-0.5.md). Map the GDPR
> targets below onto the v0.6 primitives — committed charters,
> cross-model review, `specfleet check`, and git history.

**Regulation (EU) 2016/679 — the General Data Protection Regulation
(GDPR)** — governs the processing of personal data of individuals in the
EU/EEA. SpecFleet focuses on technical and organisational measures from
Article 32, data protection by design from Article 25, and the
third-country transfer rules from Article 44. The GDPR pack ships in
**redact mode** with an EU/EEA-biased egress allow list.

## Coverage matrix

| Article  | Name                                                | SpecFleet hook                                                | Coverage notes                                                                |
|----------|-----------------------------------------------------|---------------------------------------------------------|-------------------------------------------------------------------------------|
| Art. 5   | Principles relating to processing of personal data  | `ip-guard`, `secret-redaction`, `audit-hashchain`       | Lawfulness, data minimisation, integrity, and accountability supported.       |
| Art. 25  | Data protection by design and by default            | `pre-commit-scan`, `ip-guard`                           | Default-on PII patterns; risky changes blocked at commit time.                |
| Art. 30  | Records of processing activities                    | `audit-hashchain`                                       | Append-only log feeds the RoPA.                                               |
| Art. 32  | Security of processing                              | `egress-allowlist`, `ip-guard`, `secret-redaction`      | Confidentiality, integrity, and availability of processing.                   |
| Art. 33  | Notification of personal data breach                | `audit-hashchain`                                       | Tamper-evident timeline supports the 72-hour notification clock.              |
| Art. 44  | General principle for third-country transfers       | `egress-allowlist`                                      | Allow list defaults to EU/EEA endpoints; non-EEA hosts require justification. |

## v0.5 pack behavior

In v0.5, `specfleet init --with-pack gdpr` created a GDPR policy pack and an
egress allowlist. In v0.6 there is no pack installer; capture GDPR controls in
`.specfleet/instruction.md`, require evidence in `checklist.md`, and keep
cross-border transfer decisions in normal project docs or ADRs.

## Disclaimer

Starter pack only — tune to your compliance program. GDPR compliance also
requires lawful bases for processing, data subject rights workflows, DPIAs
where applicable, and (often) a Data Protection Officer — none of which are
produced by SpecFleet.
