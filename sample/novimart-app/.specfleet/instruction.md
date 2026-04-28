---
version: "1.0.0"
organization: "NoviMart"
effectiveDate: "2025-01-15"
owners:
  - "platform-engineering@novimart.example"
  - "security-leads@novimart.example"
  - "compliance@novimart.example"
policies:
  coding:
    - "All code MUST follow SOLID principles."
    - "Public APIs MUST have inline XML documentation (.NET) or JSDoc/TSDoc (TypeScript)."
    - "Cyclomatic complexity per function MUST NOT exceed 10."
    - "All projects MUST treat warnings as errors."
    - "Backend MUST use the Backend-for-Frontend (BFF) pattern: one API per SPA, never expose downstream services directly."
    - "Frontend MUST use functional React with hooks; no class components in new code."
    - "All asynchronous code MUST handle cancellation (CancellationToken / AbortSignal)."
    - "All public functions MUST have unit tests."
    - "Minimum unit-test line coverage: 90% on changed and adjacent code."
  security:
    - "Secrets MUST NOT be committed; use Azure Key Vault and managed identities."
    - "All HTTP endpoints MUST require authentication unless explicitly marked [AllowAnonymous] with a documented business reason."
    - "Service-to-service authentication MUST use Microsoft Entra managed identities (no client secrets, no connection strings)."
    - "Dependencies MUST pass `dotnet list package --vulnerable` (zero High/Critical) and `npm audit --audit-level=high`."
    - "All container images MUST be scanned with Trivy and signed with Cosign before deploy."
    - "Customer authentication MUST use Microsoft Entra External ID (CIAM); admin authentication MUST use Microsoft Entra ID with MFA."
    - "All inputs MUST be validated server-side; output encoding MUST prevent XSS."
    - "CORS MUST list explicit origins; wildcards (*) are forbidden on authenticated endpoints."
  compliance:
    - "Personally identifiable information (PII) MUST be encrypted at rest with customer-managed keys (CMK) for restricted data."
    - "Audit logs MUST be retained for 7 years; security logs in tamper-evident storage with append-only access."
    - "Data classified as Restricted MUST NOT leave approved Azure regions: westeurope, northeurope (EU customers); eastus2, westus2 (NA customers)."
    - "GDPR data subject rights endpoints (access, rectification, erasure, portability) MUST be implemented for any service storing personal data."
    - "Cardholder data (PAN, CVV, full track) MUST NEVER be stored, logged, or transmitted by NoviMart systems. All payment flows MUST use a tokenising redirect/iframe to a PCI-DSS Level-1 provider."
    - "PCI-DSS scope reduction is mandatory: the NoviMart backend is OUT of CDE scope by design. Any PR that introduces PAN or SAD into our systems MUST be blocked."
    - "Zero Trust principles apply: verify explicitly, least-privilege access, assume breach. No network-position-based trust."
    - "Database public network access MUST be disabled; private endpoints + service endpoints only."
  operations:
    - "All services MUST emit /livez and /readyz health probes."
    - "All services MUST publish OpenTelemetry traces, metrics, and logs to Azure Monitor / App Insights."
    - "All deployments MUST be reproducible from a tagged git commit via `azd up`."
    - "Frontend bundle size budget: initial route ≤ 200 KB gzipped."
    - "Backend p99 latency budget: 500 ms on read endpoints, 1500 ms on write endpoints."
    - "Every workload MUST have a runbook in /docs/runbooks/."
    - "All resources MUST be tagged with: env, cost-center, owner, data-classification, compliance-scope."
  data:
    - "Database schema/container changes MUST be backwards compatible for at least one release (N-1 compatible)."
    - "Cosmos DB containers MUST declare a partition key chosen for write distribution and read locality; documented in /docs/architecture.md."
    - "All write operations on personal data MUST emit an audit event (actor, action, subject, timestamp)."
    - "Data retention: customer profile data 7y after last activity; cart abandonment data 30d; order data 7y; access logs 1y; security logs 7y."
approvedRuntimes:
  - "dotnet10"
  - "node20"
  - "node22"
approvedFrameworks:
  - "asp.net-core"
  - "minimal-api"
  - "ef-core"
  - "react"
  - "vite"
  - "tanstack-query"
  - "tailwind"
  - "msal-react"
  - "vitest"
  - "playwright"
  - "xunit"
  - "fluentassertions"
forbidden:
  - "eval(...)"
  - "child_process.exec with unvalidated input"
  - "string concatenation into SQL/Cosmos queries (parameterise)"
  - "client-side storage of access tokens (use HttpOnly cookies via BFF or session storage with strict patterns)"
  - "newtonsoft.json in new .NET code (use System.Text.Json)"
  - "moment.js in new TS code (use date-fns or Temporal)"
  - "any logging of request bodies on /payments, /checkout, /account routes"
contacts:
  security: "secops@novimart.example"
  compliance: "compliance@novimart.example"
  platform: "platform@novimart.example"
  privacy: "dpo@novimart.example"
---

# NoviMart — Engineering Standards

> **Status:** Effective 2025-01-15. Supersedes all prior engineering guidance.
> **Owners:** Platform Engineering, Security Leads, Compliance.
> **Mutability:** This file is **immutable** at runtime. SpecFleet will refuse any
> agent-driven write to it. Changes require a PR with approvals from
> `@novimart/security-leads` and `@novimart/compliance` (enforced by
> CODEOWNERS).

## How to read this file

Every SpecFleet agent reads `policies.*` arrays at session start and treats each
bullet as a hard rule. The Compliance agent verifies every diff against this
list before code is allowed to merge. Approved runtimes/frameworks gate what
the Dev agent may introduce. The `forbidden` list triggers an immediate halt.

## Stack baseline

- **Backend** — .NET 10 minimal API, cross-platform (Linux containers; no Windows-only APIs). EF Core for Azure SQL only; for Cosmos DB use the SDK directly with a thin repository abstraction.
- **Frontend** — React 18 + TypeScript + Vite + Tailwind + TanStack Query + MSAL for auth. State management via Query + lightweight context; no Redux unless an ADR justifies it.
- **Data** — Azure Cosmos DB (NoSQL) for product catalog, carts, orders. Azure Storage for media. Azure Cache for Redis for session/catalog cache.
- **Hosting** — Azure Container Apps (backend), Azure Static Web Apps (frontend). All resources behind private endpoints where supported.
- **Identity** — Microsoft Entra External ID (customers), Microsoft Entra ID + MFA (admins, employees, CI/CD). Managed identities for service-to-service.
- **Observability** — OpenTelemetry SDK → Azure Monitor / Application Insights. Structured logs via Serilog (.NET) and pino (Node).
- **CI/CD** — GitHub Actions; deploy via `azd`; signed images via Cosign; SBOM published per release.

## Compliance scope

NoviMart processes EU and NA customer data (GDPR applies). NoviMart is
**out of PCI-DSS CDE scope** by design — payments are handled exclusively via
a tokenising redirect to a PCI-DSS Level-1 provider; we never see, store,
log, or transmit a PAN or CVV. The PCI Reviewer subagent enforces this
boundary on every PR.

Zero Trust is the default security posture. Every service authenticates every
caller; no network-position-based trust.

## Engineering principles

1. **Tests first or alongside.** Coverage gate is 90% on changed and adjacent code; failing CI is non-negotiable.
2. **Small diffs.** Long-running PRs accumulate compliance debt. Aim for ≤ 400 LoC per PR.
3. **Reversible deploys.** Every change supports rollback to the prior tag.
4. **Observability is part of the feature.** A change without traces, metrics, and logs is incomplete.
5. **Document the why.** ADRs in `/docs/decisions/` for every architectural decision.

## How to extend this file

1. Open a PR adding rules under the appropriate `policies.*` array.
2. CODEOWNERS will auto-request review from Security and Compliance.
3. After merge, all new SpecFleet sessions pick up the change on next invocation.
4. Append a corresponding entry to `.specfleet/decisions.md`.
