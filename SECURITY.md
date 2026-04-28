# Security Policy

## Supported versions

| Version | Supported |
| ------- | :-------: |
| 0.2.x   | ✅         |
| 0.1.x   | ⚠️ critical fixes only |
| < 0.1   | ❌         |

## Reporting a vulnerability

Please report security issues **privately**. Do not open a public
GitHub issue, discussion, or PR for vulnerabilities.

- **Email:** `sepehr@pakbaz.dev` (the address listed in `package.json`)
- **Subject:** `[eas-security] <short title>`

Include:

- Affected version (`eas --version`).
- A minimal reproducer or proof of concept.
- Impact assessment (what an attacker could achieve).
- Your preferred attribution (or "anonymous").

## Disclosure timeline

We aim to:

- Acknowledge the report within **3 business days**.
- Provide a remediation plan or patch ETA within **14 days**.
- Coordinate public disclosure after a fix is released; credit the
  reporter unless they request anonymity.

## Scope

In scope:

- The `@pakbaz/eas` runtime, CLI commands, and shipped templates.
- The `eas mcp serve` MCP server.
- The hardening controls described in
  [`docs/security.md`](docs/security.md).

Out of scope:

- Vulnerabilities in `@github/copilot-sdk`, the GitHub Copilot CLI,
  or other upstream dependencies — please report those to their
  respective maintainers.
- Issues that require an already-compromised local machine.

Thank you for helping keep EAS users safe.
