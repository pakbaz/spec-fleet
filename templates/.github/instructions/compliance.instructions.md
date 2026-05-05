---
applyTo: "**/*.{md,ts,tsx,js,jsx,go,py,rs,java,kt,sql,tf,bicep,yml,yaml}"
---

# Compliance

- Treat `.specfleet/instruction.md` (the constitution) as the single source of truth for non-negotiable rules. If a request conflicts with it, surface the conflict; do not silently override.
- Never log or persist secrets, access tokens, or PII. Redact before write.
- Public APIs must document data classification of their inputs and outputs (PII / PCI / PHI / public).
- Add audit context (spec id, phase, run id) to log lines for any state-changing operation.
- Pin third-party actions / images by digest where the constitution requires it.
- When adding a new external dependency, note its license and supply-chain provenance in the relevant spec's `plan.md`.
