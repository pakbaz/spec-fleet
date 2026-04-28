# PCI DSS v4.0 Starter Pack

> Source: PCI DSS v4.0 — Payment Card Industry Data Security Standard,
> published by the PCI Security Standards Council.
>
> **Disclaimer.** Starter pack only — tune to your compliance program. Use of
> this pack does not establish PCI scope or constitute a Report on Compliance
> (RoC). Engage your QSA before relying on these patterns in production.

## What this pack covers

Patterns and egress posture appropriate for the **Cardholder Data
Environment (CDE)** or any service that may incidentally process Primary
Account Numbers (PANs), CVVs, or magstripe data. Ships in **block mode**.

## Control → EAS hook mapping

| Control | Name                                                                       | EAS hooks                              |
|---------|----------------------------------------------------------------------------|----------------------------------------|
| Req-3   | Protect stored account data                                                | `ip-guard`, `secret-redaction`         |
| Req-4   | Protect cardholder data with strong cryptography during transmission       | `egress-allowlist`, `ip-guard`         |
| Req-6   | Develop and maintain secure systems and software                           | `pre-commit-scan`                      |
| Req-7   | Restrict access to system components by business need-to-know              | `egress-allowlist`                     |
| Req-8   | Identify users and authenticate access                                     | `secret-redaction`                     |
| Req-10  | Log and monitor all access to system components and cardholder data        | `audit-hashchain`                      |

## Defaults shipped

- `egress.json` — `mode: block`, `default: deny`, allow list **empty**.
- `ip-guard.json` — `mode: block`, patterns for Visa/Mastercard/Amex/Discover
  PANs, generic 13–19 digit sequences, CVV in context, and magstripe track
  sentinels.

## How to enable

```bash
eas init --with-pack pci-dss
```

After enabling, scope the allow list to validated, in-CDE endpoints only.
Outside the CDE, prefer redaction packs (`soc2`, `iso27001`).
