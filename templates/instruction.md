---
version: "1.0.0"
organization: "Acme Corp"
effectiveDate: "2025-01-01"
owners:
  - "platform-engineering@acme.example"
policies:
  coding:
    - "All code MUST follow SOLID principles."
    - "Public APIs MUST have inline documentation."
    - "No commented-out code in committed files."
    - "Cyclomatic complexity per function MUST NOT exceed 15."
  security:
    - "Secrets MUST NOT be committed; use the corporate Key Vault."
    - "All HTTP endpoints MUST require authentication unless explicitly marked public."
    - "Dependencies MUST pass `npm audit --audit-level=high` (or language equivalent)."
    - "All container images MUST be scanned with Trivy before deploy."
  compliance:
    - "Personally identifiable information (PII) MUST be encrypted at rest."
    - "Audit logs MUST be retained for 7 years."
    - "Data classified as 'Restricted' MUST NOT leave approved Azure regions."
  operations:
    - "All services MUST emit health (/livez) and readiness (/readyz) probes."
    - "All services MUST publish OpenTelemetry traces, metrics, and logs."
    - "All deployments MUST be reproducible from a tagged git commit."
  data:
    - "Database migrations MUST be backwards compatible for at least one release."
    - "All schema changes MUST be reviewed by a Data Steward."
approvedRuntimes:
  - "node20"
  - "node22"
  - "python3.12"
  - "dotnet8"
  - "java21"
approvedFrameworks:
  - "express"
  - "fastify"
  - "nestjs"
  - "fastapi"
  - "spring-boot"
  - "react"
  - "vue"
forbidden:
  - "telnet"
  - "eval(...)"
  - "shell-injection-prone child_process patterns"
contacts:
  security: "secops@acme.example"
  compliance: "compliance@acme.example"
  platform: "platform@acme.example"
---

# Acme Corp — Engineering Standards (sample)

This is the **immutable** corporate instruction file. All EAS agents read this at
session start and refuse to violate any policy listed above. Modifying this file
requires a PR review by `@acme-corp/security-leads` and `@acme-corp/compliance`
(enforced by CODEOWNERS at the repo root).

## How to extend
1. Open a PR adding rules under the appropriate `policies.*` array.
2. Required reviewers will be notified automatically.
3. Once merged, all new agent sessions will pick up the change on next `eas` invocation.
