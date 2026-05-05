---
name: "your-project"
mode: "brownfield"
description: "TODO: summarize the product or service in one sentence."
primaryLanguage: "typescript"
runtime: "node20"
frameworks: []
dataStores: []
integrations: []
deploymentTargets: []
complianceScope: []
---

# Project cheat sheet

A one-page snapshot of this codebase that every charter consumes. Keep it lean — link out for depth.

## Stack
- **Language(s):** <e.g. TypeScript 5 ESM, Go 1.22>
- **Runtime(s):** <e.g. Node 20+, Postgres 15>
- **Frameworks:** <e.g. Fastify, Drizzle ORM, Vitest>
- **Build / package manager:** <e.g. pnpm 9, esbuild>

## Layout
```
src/         # application code
tests/       # vitest suites (mirror src/ paths)
infra/       # IaC (terraform / bicep)
.github/     # CI + agents/prompts/instructions
.specfleet/  # specs, charters, scratchpad
```

## Integrations
- Auth: <provider + flow>
- Data store(s): <DB + ORM + migration tool>
- External APIs: <names + which spec introduced them>

## Quality bars
- Test command: `pnpm test`
- Lint command: `pnpm lint`
- Type check: `pnpm typecheck`
- Coverage minimum: <e.g. 80% lines on changed files>

## Deploy
- Pipeline: <CI workflow file>
- Environments: <dev / staging / prod and how they differ>
- Rollback: <one sentence>

## Compliance scope
- Data classes handled: <PII / PCI / PHI / none>
- Frameworks: <SOC2 / GDPR / ISO27001 / …>
