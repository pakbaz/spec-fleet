# Changelog

All notable changes to `@pakbaz/eas` will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.0] — 2026-05

CLI surface simplification + new reflection command. v0.2 → v0.3 cuts the
visible command count from 17 to 10 and ships `eas config` as a single entry
point for inspecting and editing every piece of agent configuration.

### Breaking

- None at runtime. v0.2 commands still work as **deprecated hidden aliases**
  with a one-line yellow warning. `EAS_NO_DEPRECATION_WARN=1` suppresses.
  Aliases will be **removed in v0.4** — migrate now.
- The pre-commit hook installed by `eas init` now invokes
  `eas check --staged` instead of `eas precommit-scan`. Existing repos do not
  break because `eas precommit-scan` remains as an alias forever (the hook is
  on disk and we don't want to require re-installs).

### Added

- **`eas config`** — show / list / edit / new / validate / diff for the
  orchestrator instruction, charters, policies, MCP manifests, and skills.
  `edit` opens `$EDITOR` and re-validates on close. `show` redacts secrets
  before printing.
- **`eas check`** — single health & quality entrypoint. Default = doctor.
  `--deep` adds full audit chain verification. `--eval`, `--tune`, `--staged`,
  `--audit`, `--fix` flag-dispatch to existing implementations.
- **`eas log [sessionId]`** — no-arg = tail audit events (formerly
  `eas audit tail`). With sessionId = redacted replay (formerly
  `eas replay <id>`).
- **`eas run`** — replaces `eas implement` (clearer verb).
- **`eas init` state detection** — empty repo → greenfield, code without
  `.eas/` → prompt brownfield/modify/cancel, existing `.eas/` → prompt
  upgrade/overwrite/cancel. New flags: `--mode greenfield|brownfield|modify|upgrade|overwrite`,
  `--no-hooks`, `--hooks-only`, `--force`. `EAS_INIT_MODE` env var bypasses
  the prompt for scripted use.
- `eas init` now **auto-installs the git pre-commit hook** unless
  `--no-hooks`. Use `eas init --hooks-only` to install just the hook.
- `tests/unit/init-mode.test.ts`, `tests/unit/config.test.ts`, and
  `tests/unit/dispatchers.test.ts` — 22 new tests covering the new surface.

### Changed

- `eas --help` now shows 10 visible commands (init, plan, run, review, status,
  check, log, config, spec, mcp, sre). Aliases hidden from help.
- Hook script in `templates/git-hooks/` (rendered by `eas init`) now calls
  `eas check --staged` and falls back to the bundled `precommit-scan.js`.

### Deprecated (removed in v0.4)

| v0.2 | v0.3 |
|---|---|
| `eas onboard` | `eas init --mode brownfield` |
| `eas implement` | `eas run` |
| `eas doctor` | `eas check` |
| `eas audit tail` | `eas log` |
| `eas audit verify` | `eas check --audit` |
| `eas replay <id>` | `eas log <id>` |
| `eas eval` | `eas check --eval` |
| `eas tune` | `eas check --tune` |
| `eas precommit-scan` | `eas check --staged` *(kept indefinitely as hook target)* |
| `eas install-hooks` | `eas init --hooks-only` |
| `eas charter new\|list\|validate` | `eas config new charter\|list\|validate` |

## [0.2.0] — 2026-04-27

Enterprise hardening + spec-coverage release. Closes the four spec
questions in [`docs/specs.md`](docs/specs.md), ships the org-memory MCP
server, the eval/tune harness, and 13 hardening controls.

### Breaking

- None. v0.2 is additive over v0.1; existing `.eas/` directories
  continue to work. New defaults (e.g. empty egress allowlist) only
  apply when the corresponding policy file is added.

### Added

- `eas mcp serve` — stdio MCP server exposing `query_decisions`,
  `query_charter`, `query_project`, `query_audit` tools.
- `eas eval` — run benchmark suites; append to
  `.eas/eval/scoreboard.jsonl`. Ships 5 starter benchmarks
  (orchestrator, dev, test, compliance, sre).
- `eas tune` — advisory charter diffs from scoreboard + audit +
  decisions; written to `.eas/tune/<ts>.diff`. Never auto-applies.
- `eas replay <session>` — read-only reconstruction of a past session
  from its audit log.
- `eas spec new <name>` / `eas spec list` — GSD/SpecKit-shaped spec
  authoring; `eas plan --from-spec <id>` feeds a spec into the plan.
- `eas sre triage` — SARIF + audit → triage report under
  `.eas/triage/<ts>.md`; new `triage` skill.
- `eas install-hooks` — install a pre-commit hook running secret +
  IP-guard scans on the staged diff.
- `eas audit verify` — walks `.eas/audit/*.jsonl`, recomputes the
  hash chain, reports tampering.
- `--offline` flag (and `EAS_OFFLINE=1` env) — air-gap mode; refuses
  network-bound tools and MCPs.
- `eas init --with-pack <name>` — bootstrap with a compliance pack
  (`soc2`, `iso27001`, `hipaa`, `pci-dss`, `gdpr`).
- Charter signature schema: optional `signature` frontmatter and
  `policies/trusted-signers.json` (verifier present; enforcement in
  v0.3).
- 6 production skills under `templates/skills/`: `security-review`,
  `perf-review`, `accessibility`, `observability`, `iac-review`,
  `dependency-hygiene`.
- Benchmarks library under `templates/benchmarks/`.

### Fixed

- **CRITICAL** Secret redaction off-by-one in `src/util/secrets.ts`
  that left most of every matched secret visible. Regression test
  asserts no substring of the input secret remains for every built-in
  pattern.
- **HIGH** Path traversal in `eas charter new` — names containing
  `..`, leading `/`, or non-normalized segments are now rejected.
- **HIGH** Symlink follow in `eas init --instruction <path>` — the
  source is now `lstat`'d and refused if it is a symlink or
  non-regular file.
- CLI version is now read from `package.json` instead of hardcoded.

### Security

- Hash-chained audit log: each `AuditEvent` carries `prevHash` and
  `hash = sha256(prevHash || canonical(event))`. Tampering is
  detectable via `eas audit verify`. Required for SOC 2 evidence.
- Outbound egress allowlist (`policies/egress.json`): default empty
  (deny-all external); enforced via `onPreToolUse`.
- IP-guard (`policies/ip-guard.json`): patterns for proprietary
  identifiers; integrated into the same redact pipeline as secrets;
  fail-closed on detection.
- Secret + IP-guard redaction now applied to **all** tool I/O via
  `onPreToolUse` (block writes containing matches) and
  `onPostToolUse` (redact before parent reads).
- Pre-commit hook scans staged diff for secrets + IP-guard matches.
- No-telemetry CI gate: `grep` over `dist/` for forbidden hosts;
  build fails on match. Documented in
  [`docs/security.md`](docs/security.md).
- SBOM (`dist/sbom.spdx.json`) generated at build time and shipped in
  the npm tarball; npm publish provenance enabled.
- Air-gap mode forces empty egress regardless of policy file.

### Docs

- New: [`docs/context-strategies.md`](docs/context-strategies.md) —
  the 4-strategy comparison and recommendation matrix.
- New: [`docs/harness-management.md`](docs/harness-management.md) —
  the eval → tune → review loop, cadence, anti-patterns.
- New: [`docs/security.md`](docs/security.md) — threat model and the
  13 hardening controls with config snippets.
- New: 5 compliance pages under `docs/compliance/` (`soc2.md`,
  `iso27001.md`, `hipaa.md`, `pci-dss.md`, `gdpr.md`).
- New: [`SECURITY.md`](SECURITY.md) — AS-IS / no-support statement.
- Updated: README — "What's new in v0.2", security one-pager
  checklist, command table, air-gap snippet.
- Updated: [`docs/specs.md`](docs/specs.md) — appended "How EAS v0.2
  answers this" footer mapping each Q1–Q5 to commands and files.

## [0.1.0] — 2025-04-27

Initial public release.

### Added

- `eas init` — bootstrap `.eas/` in a greenfield repo with charters, policies,
  decisions, and a guided interview.
- `eas onboard` — non-destructive scaffold for brownfield repos.
- `eas plan` / `eas implement` / `eas review` — orchestrator → role agent →
  subagent flow on top of GitHub Copilot SDK + CLI fleet mode.
- `eas charter` — create / validate / list charters with per-charter
  `maxContextTokens` enforcement.
- `eas status` — session inspector for live and completed runs.
- `eas audit` — query `.eas/audit/<sessionId>.jsonl` event streams.
- `eas doctor` — environment + auth + policy preflight.
- 32 charter templates covering orchestrator, architect, dev, test, devsecops,
  compliance (GDPR / PCI / Zero Trust), and SRE roles plus their subagents.
- Policy gates: secret redaction, token-budget caps (default 80K, hard cap 95K),
  immutable corporate `instruction.md`.
- Append-only audit log of every prompt, tool use, permission request, and
  policy block.
- Sample full-stack e-commerce app under `sample/ecommerce-app/` (.NET 10 BFF
  + React/Vite, Bicep IaC, GitHub Actions, 4 walkthroughs, 3 compliance docs).

### Packaging

- Published to npmjs.com as `@pakbaz/eas` with build provenance.
- ESM-only, Node 20+.
- Ships `dist/`, `templates/`, `LICENSE`, `README.md`, `CHANGELOG.md`.

[Unreleased]: https://github.com/pakbaz/enteprise-agents-system/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/pakbaz/enteprise-agents-system/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/pakbaz/enteprise-agents-system/releases/tag/v0.1.0
