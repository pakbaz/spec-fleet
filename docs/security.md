# SpecFleet Security Model (v0.6)

> **No-warranty statement.** SpecFleet is **AS-IS** (see [SECURITY.md](../SECURITY.md)).
> v0.6 is a thin shim over the GitHub Copilot CLI — most of the safety
> properties below come from Copilot CLI itself, the host OS, and the
> normal pull-request review process. SpecFleet does **not** ship a
> runtime policy gate; trust is rooted in committed `.specfleet/`
> artefacts that are reviewed in PRs.

## Threat model

| Asset | Threat | Mitigation |
| --- | --- | --- |
| Corporate engineering standards (`.specfleet/instruction.md`) | Agent rewrites it to bypass standards | Reviewed in PRs; protected by CODEOWNERS (see `templates/CODEOWNERS.example`) |
| Charter prompts (`.specfleet/charters/*.charter.md`) | Stealth modification of agent behaviour | Reviewed in PRs; mirrored to `.github/agents/` so `git diff` catches drift |
| Tool surface (e.g. shell, write) | Excessive privilege at runtime | Per-charter `allowedTools` mapped to `--allow-tool` flags; Copilot CLI prompts the user to confirm tool calls |
| Secrets in working tree | Accidental leak | `specfleet check --staged` scans `git diff --cached` against built-in patterns + `.specfleet/policies/secrets.json` extension |
| Run transcripts (`.specfleet/runs/*.jsonl`) | Surfacing PII / secrets in logs | Transcripts include argv plus stdout/stderr chunks; review them like other generated artefacts before committing |
| Reviewer collusion | The implementer model also reviews its own work | Cross-model review (`models.review`) defaults to a different vendor — see [ADR-0005](adr/0005-cross-model-review.md) |
| Supply chain | Malicious dependency in the SpecFleet package | Lean dep tree (7 runtime deps); npm provenance attestations on every release |

## What v0.5 provided that v0.6 does not

- **Hash-chained audit log.** v0.6 logs runs as plain JSONL under
  `.specfleet/runs/`. Tamper-evidence comes from git history of the
  same files. If you need cryptographic chaining, run a separate
  signing step in CI.
- **Runtime permission gate / write-block on `instruction.md`.** v0.6
  has no in-process gate. The same protection comes from CODEOWNERS +
  branch protection on the file path.
- **Policy DSL + Rego packs.** v0.6 has no policy engine. If you need
  enforceable network or path policies, layer OPA / a sandbox runner
  underneath your invocation of `specfleet`.
- **`specfleet sre triage` for SARIF.** Out of scope for v0.6. Use
  GitHub Code Scanning directly.

## What v0.6 still does

1. **Token budget gate.** Every charter has `maxContextTokens` (default
   60K, hard ceiling 95K). The runner refuses to dispatch a prompt that
   exceeds the cap.
2. **Charter mirror parity.** `specfleet check` re-derives the
   `.github/agents/` mirror and fails if it drifts from
   `.specfleet/charters/`.
3. **Secret-scan gate.** `specfleet check --staged` rejects a commit
   that introduces a secret matching any built-in pattern or the
   user's `.specfleet/policies/secrets.json`.
4. **MCP servers default off.** Charters ship with `mcpServers: []`;
   each MCP server must be opted in explicitly per charter, matching
   the community Spec-Kit guidance.
5. **Cross-model review by default** so the implementer is not the
   reviewer.
6. **Path-scoped instructions.** `.github/instructions/<x>.instructions.md`
   carries `applyTo:` globs so security guidance targets only the right
   files.

## Operational guidance

- Treat `.specfleet/instruction.md` and `.specfleet/charters/` as
  high-trust paths in CODEOWNERS.
- Keep `.specfleet/runs/*.jsonl` out of long-term storage if your
  prompts include sensitive data — they record prompt byte counts but
  the underlying transcripts can grow.
- Do not enable shell/write tools on charters that don't need them —
  even though Copilot CLI confirms each tool call, fewer surfaces is
  fewer surprises.
- Run `specfleet check` in CI on every PR so charter drift cannot land
  silently.

For compliance overlays (SOC 2, ISO 27001, HIPAA, PCI-DSS, GDPR) see
[docs/compliance/](compliance/). Those documents map SpecFleet primitives
to specific controls; some of the v0.5-era capabilities they referenced
(e.g. policy packs) are out of scope for v0.6 and are noted as such.
