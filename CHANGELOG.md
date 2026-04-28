# Changelog

All notable changes to `@pakbaz/specfleet` will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.4.0] — 2026-04-28

Full SpecFleet rebrand and package transition. This release moves the project
to the new `@pakbaz/specfleet` package and `specfleet` command, positioning it as a
SpecKit-vNext style, spec-first agent orchestration platform.

### Breaking

- Package name is now `@pakbaz/specfleet`.
- CLI binary is now `specfleet`; no `eas` binary is shipped by this package.
- Generated project state now lives under `.specfleet/`.
- Deprecated v0.3 subcommand aliases are removed from the visible runtime
  surface. Use `run`, `check`, `log`, and `config`.

### Added

- Legacy `.eas/` migration path: `specfleet init --mode upgrade` copies old
  state into `.specfleet/` non-destructively and leaves `.eas/` in place for
  review.
- NoviMart sample app replaces the previous sample branding and path.

### Changed

- README, CLI reference, quickstart, specs, security docs, publishing docs,
  templates, and tests now use SpecFleet naming and `.specfleet/` paths.
- GitHub repository metadata points to `pakbaz/specfleet`.
- npm OIDC release workflow checks and publishes the `@pakbaz/specfleet` package.
- Pre-commit hook script invokes `specfleet check --staged`.

## [0.3.0] — 2026-04-27

Final release of the prior package line before the SpecFleet rename. It
introduced the simplified 10-command surface, smart init, `config`, `check`,
and `log`.

## [0.2.0] — 2026-04-27

Enterprise hardening + spec-coverage release. Closes the four spec
questions in [`docs/specs.md`](docs/specs.md), ships the org-memory MCP
server, the eval/tune harness, and 13 hardening controls.

### Breaking

- None. v0.2 is additive over v0.1; existing `.specfleet/` directories
  continue to work. New defaults (e.g. empty egress allowlist) only
  apply when the corresponding policy file is added.

### Added

- `specfleet mcp serve` — stdio MCP server exposing `query_decisions`,
  `query_charter`, `query_project`, `query_audit` tools.
- `specfleet check --eval` — run benchmark suites; append to
  `.specfleet/eval/scoreboard.jsonl`. Ships 5 starter benchmarks
  (orchestrator, dev, test, compliance, sre).
- `specfleet check --tune` — advisory charter diffs from scoreboard + audit +
  decisions; written to `.specfleet/tune/<ts>.diff`. Never auto-applies.
- `specfleet log <session>` — read-only reconstruction of a past session
  from its audit log.
- `specfleet spec new <name>` / `specfleet spec list` — GSD/SpecKit-shaped spec
  authoring; `specfleet plan --from-spec <id>` feeds a spec into the plan.
- `specfleet sre triage` — SARIF + audit → triage report under
  `.specfleet/triage/<ts>.md`; new `triage` skill.
- `specfleet init --hooks-only` — install a pre-commit hook running secret +
  IP-guard scans on the staged diff.
- `specfleet check --audit` — walks `.specfleet/audit/*.jsonl`, recomputes the
  hash chain, reports tampering.
- `--offline` flag (and `SPECFLEET_OFFLINE=1` env) — air-gap mode; refuses
  network-bound tools and MCPs.
- `specfleet init --with-pack <name>` — bootstrap with a compliance pack
  (`soc2`, `iso27001`, `hipaa`, `pci-dss`, `gdpr`).
- Charter signature schema: optional `signature` frontmatter and
  `policies/trusted-signers.json` (verifier present; enforcement in
  v0.4).
- 6 production skills under `templates/skills/`: `security-review`,
  `perf-review`, `accessibility`, `observability`, `iac-review`,
  `dependency-hygiene`.
- Benchmarks library under `templates/benchmarks/`.

### Fixed

- **CRITICAL** Secret redaction off-by-one in `src/util/secrets.ts`
  that left most of every matched secret visible. Regression test
  asserts no substring of the input secret remains for every built-in
  pattern.
- **HIGH** Path traversal in `specfleet config new charter` — names containing
  `..`, leading `/`, or non-normalized segments are now rejected.
- **HIGH** Symlink follow in `specfleet init --instruction <path>` — the
  source is now `lstat`'d and refused if it is a symlink or
  non-regular file.
- CLI version is now read from `package.json` instead of hardcoded.

### Security

- Hash-chained audit log: each `AuditEvent` carries `prevHash` and
  `hash = sha256(prevHash || canonical(event))`. Tampering is
  detectable via `specfleet check --audit`. Required for SOC 2 evidence.
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
- Updated: [`docs/specs.md`](docs/specs.md) — appended "How SpecFleet v0.2
  answers this" footer mapping each Q1–Q5 to commands and files.

## [0.1.0] — 2025-04-27

Initial public release.

### Added

- `specfleet init` — bootstrap `.specfleet/` in a greenfield repo with charters, policies,
  decisions, and a guided interview.
- `specfleet onboard` — non-destructive scaffold for brownfield repos.
- `specfleet plan` / `specfleet run` / `specfleet review` — orchestrator → role agent →
  subagent flow on top of GitHub Copilot SDK + CLI fleet mode.
- `specfleet config` — create / validate / list charters with per-charter
  `maxContextTokens` enforcement.
- `specfleet status` — session inspector for live and completed runs.
- `specfleet log` — query `.specfleet/audit/<sessionId>.jsonl` event streams.
- `specfleet check` — environment + auth + policy preflight.
- 32 charter templates covering orchestrator, architect, dev, test, devsecops,
  compliance (GDPR / PCI / Zero Trust), and SRE roles plus their subagents.
- Policy gates: secret redaction, token-budget caps (default 80K, hard cap 95K),
  immutable corporate `instruction.md`.
- Append-only audit log of every prompt, tool use, permission request, and
  policy block.
- Sample full-stack NoviMart app under `sample/novimart-app/` (.NET 10 BFF
  + React/Vite, Bicep IaC, GitHub Actions, 4 walkthroughs, 3 compliance docs).

### Packaging

- Published to npmjs.com as `specfleet` with build provenance.
- ESM-only, Node 20+.
- Ships `dist/`, `templates/`, `LICENSE`, `README.md`, `CHANGELOG.md`.

[Unreleased]: https://github.com/pakbaz/specfleet/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/pakbaz/specfleet/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/pakbaz/specfleet/releases/tag/v0.1.0
