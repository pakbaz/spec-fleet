---
name: dependency-hygiene
applies_to: [devsecops, dev, compliance]
---

# When to use

Run on any PR touching `package.json`, `package-lock.json`, `requirements.txt`,
`pyproject.toml`, `poetry.lock`, `go.mod`, `go.sum`, `pom.xml`, `Cargo.toml`,
or container base images.

# Procedure

1. **Vulnerability triage.**
   - Run `npm audit --audit-level=high` / `pip-audit` / `govulncheck` /
     `cargo audit` and attach output.
   - For each HIGH/CRITICAL: confirm a fix version exists, or document a
     temporary mitigation with an expiry date in `decisions.md`.
2. **License check.**
   - Allow list: MIT, Apache-2.0, BSD-2/3-Clause, ISC, MPL-2.0, Unlicense.
   - Review needed: LGPL (linking), EPL, CDDL.
   - **Block** by default: GPL-3.0, AGPL-3.0, SSPL, BUSL, "Commons Clause"
     unless explicitly approved by Legal in `decisions.md`.
3. **Pinning.**
   - Production lockfile committed (`package-lock.json`, `poetry.lock`,
     `go.sum`).
   - Container base images pinned by digest (`@sha256:…`), not `:latest`.
   - No `^` or `~` ranges in production dependencies for security-critical
     libs (crypto, auth, web framework).
4. **Supply chain.**
   - Prefer packages with **Sigstore / npm provenance** attestations; flag
     deps without any provenance.
   - Generate / update SBOM (`syft`, `cyclonedx-npm`) and commit under
     `sbom/` or attach to the release.
   - Verify package age and download trend; brand-new (<30 days) packages
     with low download counts require justification.
5. **Transitive bloat.**
   - Note any new top-level dep that pulls > 50 transitive deps.
   - Prefer well-maintained alternatives or vendoring small utilities.
6. **Update cadence.** Confirm Dependabot / Renovate is enabled and not
   muted for this repo.

# Outputs

- `dependency-review.md` block with: package, version, vuln IDs, license,
  decision (approve / mitigate / block).
- Updated SBOM artifact reference.
