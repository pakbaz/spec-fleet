# SpecFleet Security Model

> **No-warranty statement.** SpecFleet is **AS-IS** (see [SECURITY.md](../SECURITY.md)).
> It is a Spec Kit extension made of prompt command files and settings. It does
> not ship a local CLI runtime, MCP server, npm package, or in-process policy gate.
> Trust is rooted in reviewed, committed artifacts and the user's agent host.

## Threat model

| Asset | Threat | Mitigation |
| --- | --- | --- |
| Project standards / constitution | Agent rewrites standards to bypass governance | Review in PRs and protect with CODEOWNERS/branch rules |
| Feature charter (`specs/<feature>/charter.md`) | Stealth modification of task contract | Review in PRs; `/speckit.specfleet.check` validates required structure |
| Scratchpad (`specs/<feature>/scratchpad.md`) | Losing decisions or rewriting prior findings | Append-only command guidance; `/speckit.specfleet.check` verifies section order |
| Tool surface (shell/write/network) | Excessive privilege at runtime | Controlled by the user's Spec Kit/agent host, not by SpecFleet |
| Secrets in artifacts | Accidental leak | `/speckit.specfleet.check` flags obvious credential-shaped strings in charter/scratchpad files |
| Reviewer collusion | Implementer model reviews its own work | Cross-model review uses `models.review` from `.specify/extensions/specfleet/specfleet-config.yml` |
| Supply chain | Unexpected package/runtime behavior | No standalone runtime is installed; users install version-pinned command files from a tagged GitHub archive |

## What SpecFleet does

1. **Charter contracts.** `/speckit.specfleet.charter` writes a small,
   reviewable task contract for the active feature.
2. **Shared scratchpad.** `/speckit.specfleet.scratchpad` keeps phase-to-phase
   findings and decisions visible.
3. **Cross-model review.** `/speckit.specfleet.review` grades implementation
   against the charter and scratchpad with the configured review model.
4. **Artifact check.** `/speckit.specfleet.check` validates charter/scratchpad
   structure and reports obvious secret-like strings.

## What SpecFleet does not do

- It does not enforce sandboxing, network allowlists, or runtime tool policies.
- It does not run CI, publish packages, or execute a local CLI.
- It does not replace core Spec Kit phases; use `/speckit.*` for the lifecycle.

## Operational guidance

- Keep `.specify/extensions/specfleet/specfleet-config.yml` reviewed like other
  project settings.
- Treat `specs/<feature>/charter.md`, `scratchpad.md`, and `review.md` as
  high-trust files during code review.
- Run `/speckit.specfleet.check` before merging feature work.
- Keep secrets out of prompts and generated artifacts; the extension check is a
  guardrail, not a replacement for repository secret scanning.

For compliance overlays (SOC 2, ISO 27001, HIPAA, PCI-DSS, GDPR) see
[docs/compliance/](compliance/).
