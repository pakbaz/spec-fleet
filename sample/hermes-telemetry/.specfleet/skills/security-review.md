---
name: security-review
applies_to: [dev, devsecops, architect, compliance]
---

# When to use

Invoke before merging any change that touches authentication, authorization,
input handling, secrets, network boundaries, IaC, or third-party integrations.
Also runs on every PR labelled `security-sensitive`.

# Procedure

1. **Map the change.** List entry points (HTTP routes, queues, CLI flags) and
   data sinks touched by the diff.
2. **OWASP Top 10 sweep** (2021 edition). For each finding, note category
   (A01 Broken Access Control … A10 SSRF) and a one-line evidence pointer:
   - A01: missing authz checks, IDOR, path traversal.
   - A02: weak crypto, hard-coded keys, plaintext at rest.
   - A03: SQLi/NoSQLi, command injection, template injection.
   - A05: default creds, debug endpoints, verbose errors.
   - A07: missing MFA, session fixation, weak password policy.
   - A08: unsigned artifacts, untrusted deserialization.
   - A10: SSRF via unvalidated URLs, blind SSRF in webhooks.
3. **Secrets scan.** Confirm `pre-commit-scan` is green; spot-check for
   `.env`, kubeconfig, PEM blocks, and cloud keys not caught by patterns.
4. **AuthN/AuthZ matrix.** For each new route: who can call it, what scope is
   required, and how the test suite proves the negative case (401/403).
5. **IaC drift.** If Terraform/Bicep changed, run `iac-review` skill.
6. **Dependencies.** If `package.json` / `requirements.txt` / `go.mod` changed,
   run `dependency-hygiene` skill.

# Outputs

- `security-review.md` block in the PR with a table: finding, severity
  (critical/high/medium/low), file:line, recommendation.
- An explicit **APPROVE / BLOCK** verdict at the bottom.
- If BLOCK, open a follow-up issue tagged `security` with reproduction steps.
