# SpecFleet Security Model

SpecFleet runs autonomous agents against a real codebase with real credentials.
This document describes the threat model and the 13 hardening controls
that ship in v0.2.

---

## Threat model

| Asset                         | Threat                                                | Primary mitigation                                  |
| ----------------------------- | ----------------------------------------------------- | --------------------------------------------------- |
| Source code & IP              | Exfiltration to a third-party model or MCP server     | Egress allowlist; IP-guard; air-gap mode            |
| Credentials & tokens          | Leak into a prompt, log, or commit                    | Secret redaction on all tool I/O; pre-commit hook   |
| Repository integrity          | Unintended writes to immutable files                  | Permission gate; CODEOWNERS on `.specfleet/`              |
| Audit log                     | Tampering to hide a policy block                      | Hash-chained JSONL; `specfleet check --audit`              |
| Charter library               | Substitution / supply-chain attack on charter content | Charter signature schema and trusted-signer policy |
| Build artefacts               | Tampered dependency in `dist/`                        | SBOM (SPDX), npm provenance                         |
| Runtime configuration         | Hostile policy file added to a fork                   | `specfleet check` validates schemas; pre-commit scan     |
| Telemetry                     | Silent phone-home from runtime or deps                | No-telemetry policy; CI grep gate                   |

SpecFleet assumes the operator's machine is trusted, the GitHub Copilot CLI
auth is trusted, and the `.specfleet/` directory is reviewed by humans.
Everything outside that perimeter is treated as hostile.

---

## 1. Secret redaction (built-in + extensible)

**Protects against.** Tokens, API keys, passwords, or session cookies
appearing in tool inputs, tool outputs, prompts, or commits.

**How it works.** Every value crossing a session boundary, tool boundary,
or file write is run through `redact()` (matchers in
`templates/policies/secrets.json`). Matches are replaced with
`[REDACTED:<rule>]`. The v0.2 release fixes a critical off-by-one that
left part of every secret visible in v0.1.

**Enable / extend.** Add patterns to `.specfleet/policies/secrets.json`:

```json
{
  "patterns": [
    { "name": "novimart-internal-key", "regex": "NOVIMART_[A-Z0-9]{32}" },
    { "name": "github-pat",         "regex": "ghp_[A-Za-z0-9]{36}" }
  ]
}
```

Hooks: `onPreToolUse` blocks writes containing matches; `onPostToolUse`
redacts outputs before the parent agent reads them.

See [`templates/policies/secrets.example.json`](../templates/policies/secrets.example.json).

---

## 2. IP-guard

**Protects against.** Proprietary identifiers (codenames, internal
hostnames, Jira keys, cluster names) leaking into prompts or to external
MCP servers.

**How it works.** Same redact pipeline as secrets, sourced from
`policies/ip-guard.json`. Fail-closed by default: a detected match
aborts the tool call.

**Enable.**

```json
{
  "patterns": [
    { "name": "codename",   "regex": "Project[- ]Nightingale" },
    { "name": "internal-host","regex": "[a-z0-9-]+\\.corp\\.example\\.net" },
    { "name": "jira-key",   "regex": "NOVIMART-\\d{3,6}" }
  ],
  "onMatch": "block"
}
```

See [`templates/policies/ip-guard.example.json`](../templates/policies/ip-guard.example.json).

---

## 3. Egress allowlist

**Protects against.** Tools or MCP servers reaching unintended hosts —
exfiltration, supply-chain pull from a hostile registry, accidental
prod calls during eval.

**How it works.** `policies/egress.json` enumerates allowed hostnames.
The runtime hooks `onPreToolUse` and rejects any tool call whose args
contain a URL with a non-allowlisted host. **Default is empty
(deny-all external).**

**Enable.**

```json
{
  "allowed": [
    "api.github.com",
    "registry.npmjs.org",
    "raw.githubusercontent.com"
  ]
}
```

See [`templates/policies/egress.example.json`](../templates/policies/egress.example.json).

---

## 4. Audit hash-chain

**Protects against.** Silent tampering of the audit log to hide a
policy block, a tool use, or a permission grant.

**How it works.** Each `AuditEvent` line in
`.specfleet/audit/<sessionId>.jsonl` carries `prevHash` and `hash` fields.
`hash = sha256(prevHash || canonical(event))`. The first line's
`prevHash` is the empty string. `specfleet check --audit` walks every session
file, recomputes, and reports any line whose hash chain breaks.

**Use.**

```bash
specfleet check --audit                      # all sessions
specfleet check --audit --session <id>       # one session
```

A non-zero exit code from `specfleet check --audit` is a hard fail in CI and
is the canonical signal for SOC 2 evidence collection.

---

## 5. Air-gap mode (`SPECFLEET_OFFLINE=1`)

**Protects against.** Any unintended network egress, including from
buggy MCP servers or transitively-pulled deps.

**How it works.** When `SPECFLEET_OFFLINE=1` (or `--offline` is passed), the
runtime:

- Refuses to start if a charter declares an MCP that requires network.
- Disables every tool whose manifest declares network use.
- Forces the egress allowlist to empty regardless of policy file.
- Reports air-gap readiness from `specfleet check`.

**Use.**

```bash
SPECFLEET_OFFLINE=1 specfleet plan "Ship a hello-world endpoint"
specfleet check --offline      # verify air-gap correctness
```

---

## 6. Pre-commit hook

**Protects against.** Secrets or IP-guard hits making it into a commit
and pushed before CI catches them.

**How it works.** `specfleet init --hooks-only` writes `.git/hooks/pre-commit`
that runs `findSecrets` + IP-guard against the staged diff and aborts
the commit on any match. Shebang is `#!/bin/sh` for portability.

**Enable.**

```bash
specfleet init --hooks-only
git add .
git commit -m "..."   # blocked if a match is found
```

---

## 7. Charter signing

**Protects against.** Substituted or unauthorized charters
(supply-chain or insider).

**How it works.** Charter frontmatter accepts an optional
`signature: <sigstore bundle>` field; `policies/trusted-signers.json`
lists accepted signing identities; `specfleet check` verifies presented
signatures and warns when a charter is unsigned. Verification is **not
required** in v0.2 — the goal is to ship the schema, the verifier, and
the workflow so teams can opt in. Required-signature enforcement
is part of the SpecFleet policy model.

```yaml
---
name: dev-backend
maxContextTokens: 80000
signature: |
  -----BEGIN SIGSTORE BUNDLE-----
  ...
  -----END SIGSTORE BUNDLE-----
---
```

---

## 8. No-telemetry policy

**Protects against.** Silent phone-home from SpecFleet itself or from a
dependency.

**Policy.** SpecFleet ships **zero outbound calls** other than:

- The Copilot SDK's authenticated calls (which the user has already
  opted into via `copilot login`).
- MCP servers explicitly listed in a charter and allowed by the
  egress policy.

**CI gate.** A `grep` step in CI scans `dist/` for forbidden hosts and
fails the build on any match. The list lives at
`.github/no-telemetry-hosts.txt`.

```bash
# What CI runs:
! grep -REn -f .github/no-telemetry-hosts.txt dist/
```

---

## 9. SBOM + provenance

**Protects against.** Tampered or vulnerable dependencies in shipped
artefacts; regulator demand for a Software Bill of Materials.

**How it works.**

- `npm run build` writes `dist/sbom.spdx.json` (CycloneDX/SPDX walker
  over the npm lockfile).
- `npm publish` runs with `--provenance` (already enabled via
  `publishConfig.provenance: true` in `package.json`).
- Both artefacts ship inside the npm tarball and as GitHub release
  assets.

Consume with:

```bash
npm view @pakbaz/specfleet dist
# verify provenance
gh attestation verify <tarball> --owner pakbaz
```

---

## 10. Compliance packs

Per-framework bundles of policies and skills under
`templates/policies/packs/<name>/`. `specfleet init --with-pack <name>`
seeds the right rules during bootstrap. Each pack has a one-page map
of regulator controls → SpecFleet hooks under `docs/compliance/`:

- [`docs/compliance/soc2.md`](compliance/soc2.md)
- [`docs/compliance/iso27001.md`](compliance/iso27001.md)
- [`docs/compliance/hipaa.md`](compliance/hipaa.md)
- [`docs/compliance/pci-dss.md`](compliance/pci-dss.md)
- [`docs/compliance/gdpr.md`](compliance/gdpr.md)

```bash
specfleet init --with-pack soc2
specfleet init --with-pack hipaa --with-pack gdpr
```

---

## 11. Permission gate (recap)

Per-charter `allowedTools` and `mcpServers` lists are enforced at the
SDK permission boundary. A charter without `shell` cannot run
commands; a charter without `write` cannot mutate the repo. Immutable
files (e.g. `.specfleet/instruction.md`) are rejected at the gate
regardless of charter.

---

## 12. Token-budget enforcement (recap)

Every charter declares `maxContextTokens` (default 80K, hard cap 95K).
The runtime estimates and refuses to issue any prompt that would
exceed the cap. Limits and policy-blocks are recorded in the audit
log.

---

## 13. Path & symlink hardening

`specfleet config new charter` rejects names containing `..` or absolute paths.
`specfleet init --instruction <path>` `lstat`s the source, refuses
symlinks, and refuses non-files. Both fixes ship in v0.2.

---

## Support status

`specfleet` is provided AS-IS with no security support, no
maintenance commitment, and no vulnerability-response process. See
[`SECURITY.md`](../SECURITY.md) and [`LICENSE`](../LICENSE). Operators
are responsible for their own review, hardening, monitoring, and
incident response.
