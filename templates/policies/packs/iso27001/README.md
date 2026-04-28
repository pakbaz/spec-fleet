# ISO/IEC 27001:2022 Starter Pack

> Source: ISO/IEC 27001:2022 Annex A and ISO/IEC 27002:2022 implementation
> guidance.
>
> **Disclaimer.** Starter pack only — tune to your compliance program. Annex A
> control titles are paraphrased; verify against the published standard before
> citing in audit evidence.

## What this pack covers

A baseline of organizational and technical controls from the 2022 revision
(four-theme structure: Organizational, People, Physical, Technological) most
relevant to AI-agent operations: access, cloud services, logging, data leak
prevention, and secure coding.

## Control → EAS hook mapping

| Control | Name                                              | EAS hooks                                            |
|---------|---------------------------------------------------|------------------------------------------------------|
| A.5.15  | Access control                                    | `egress-allowlist`, `ip-guard`                       |
| A.5.23  | Information security for use of cloud services    | `egress-allowlist`                                   |
| A.5.33  | Protection of records                             | `audit-hashchain`                                    |
| A.8.2   | Privileged access rights                          | `pre-commit-scan`, `secret-redaction`                |
| A.8.12  | Data leakage prevention                           | `ip-guard`, `secret-redaction`, `egress-allowlist`   |
| A.8.15  | Logging                                           | `audit-hashchain`                                    |
| A.8.28  | Secure coding                                     | `pre-commit-scan`                                    |

## Defaults shipped

- `egress.json` — `mode: redact`, default-deny with allow list for code
  registries and Microsoft cloud endpoints.
- `ip-guard.json` — `mode: redact`, patterns for private keys, cloud keys,
  generic high-entropy secret assignments, and internal hostnames.

## How to enable

```bash
eas init --with-pack iso27001
```
