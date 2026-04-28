# GDPR Starter Pack

> Source: Regulation (EU) 2016/679 — General Data Protection Regulation
> (GDPR), with reference to EDPB guidelines.
>
> **Disclaimer.** Starter pack only — tune to your compliance program. Legal
> bases for processing, DPIAs, and data-subject-rights workflows are out of
> scope; this pack only addresses technical safeguards and data-leak
> detection.

## What this pack covers

A redaction-oriented baseline for handling EU/EEA personal data: lawful
processing principles (Art. 5), data protection by design (Art. 25),
security of processing (Art. 32), and third-country transfers (Art. 44).

## Control → EAS hook mapping

| Article  | Name                                                 | EAS hooks                                                |
|----------|------------------------------------------------------|----------------------------------------------------------|
| Art. 5   | Principles relating to processing of personal data   | `ip-guard`, `secret-redaction`, `audit-hashchain`        |
| Art. 25  | Data protection by design and by default             | `pre-commit-scan`, `ip-guard`                            |
| Art. 30  | Records of processing activities                     | `audit-hashchain`                                        |
| Art. 32  | Security of processing                               | `egress-allowlist`, `ip-guard`, `secret-redaction`       |
| Art. 33  | Notification of personal data breach                 | `audit-hashchain`                                        |
| Art. 44  | General principle for third-country transfers        | `egress-allowlist`                                       |

## Defaults shipped

- `egress.json` — `mode: redact`, default-deny with allow list biased toward
  EU/EEA endpoints (West/North Europe Azure regions).
- `ip-guard.json` — `mode: redact`, patterns for email, IBAN, UK NINO, German
  Steuer-ID, French NIR, passport numbers, and IPv4 addresses (treated as
  personal data per CJEU case law).

## How to enable

```bash
eas init --with-pack gdpr
```

Review `egress.json` before allowing non-EEA endpoints — Article 44 requires
an adequacy decision, Standard Contractual Clauses, or Binding Corporate
Rules.
