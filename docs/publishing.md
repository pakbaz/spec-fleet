# Publishing `@pakbaz/specfleet`

This document is for **maintainers** cutting a new release of the SpecFleet CLI to
[npmjs.com](https://www.npmjs.com/package/@pakbaz/specfleet).

End users do not need any of this — they install with `npm i -g @pakbaz/specfleet`.

## Versioning policy

We follow [Semantic Versioning](https://semver.org/):

| Bump | When |
|---|---|
| **MAJOR** (`1.0.0 → 2.0.0`) | Breaking change to a CLI flag, charter schema, or `.specfleet/` layout |
| **MINOR** (`0.1.0 → 0.2.0`) | New command, new charter type, new template, additive policy field |
| **PATCH** (`0.1.0 → 0.1.1`) | Bug fix, doc fix, dependency bump that doesn't change behaviour |

While we're on `0.x`, *every* release may technically break things — we still
try to honour the table above and call out breaks in `CHANGELOG.md`.

## One-time setup

SpecFleet publishes through **npm Trusted Publishing (OIDC)**. Do not create or
store long-lived npm tokens for release automation.

1. Create or reserve the `@pakbaz/specfleet` package on npmjs.com.
2. In npm package settings, add GitHub trusted publisher:
   - Repository: `pakbaz/spec-fleet`
   - Workflow: `release.yml`
   - Environment: `publish`
3. In GitHub, create the `publish` environment if it does not already exist.
4. Confirm `.github/workflows/release.yml` has `id-token: write` and does not
   set `NODE_AUTH_TOKEN` for the publish step.

## Cutting a release

### Local publish (manual, requires interactive OTP)

```bash
# 1. Make sure main is green and you're on it
git switch main && git pull

# 2. Publish — provenance is OFF locally (only works in CI with OIDC)
cd /path/to/specfleet
npm publish --provenance=false --otp=<your-6-digit-2fa-code>
```

If you have an automation token with **bypass 2fa** enabled, you can skip
`--otp`. Without that, npm rejects the publish with `E403 Two-factor
authentication ... required`.

### Tagged release via CI (recommended, gets provenance)

```bash
# 1. Make sure main is green and you're on it
git switch main && git pull

# 2. Bump version + write changelog (does NOT publish)
npm version patch   # or minor / major / 0.2.0-rc.1
$EDITOR CHANGELOG.md

# 3. Commit changelog edit
git add CHANGELOG.md
git commit --amend --no-edit
git push --follow-tags
```

`npm version` creates the `vX.Y.Z` tag. Pushing it triggers
[`.github/workflows/release.yml`](../.github/workflows/release.yml), which:

1. Checks out the tag
2. Runs `npm ci`, `npm run build`, `npm test`
3. Verifies the tag matches `package.json#version`
4. Runs `npm publish --access public --provenance`

The `--provenance` flag publishes a signed
[SLSA build attestation](https://docs.npmjs.com/generating-provenance-statements)
linking the tarball to this repo + commit. Free, on by default.

## Dry run before tagging

If you want to preview what *would* be published without actually publishing:

```bash
# Locally — see exactly which files end up in the tarball
npm pack --dry-run

# In CI — runs the publish workflow with --dry-run
gh workflow run release.yml --field dry_run=true
```

## Hot-fixing a bad release

1. **Don't unpublish unless within 72h** — npm allows it, but the version is
   forever burned. Prefer publishing a patch.
2. **Deprecate the bad version**:
   ```bash
   npm deprecate @pakbaz/specfleet@0.1.3 "Critical bug in specfleet init; use 0.1.4+"
   ```
3. Cut a `0.1.4` patch with the fix and call it out in `CHANGELOG.md`.

## Smoke check after publishing

```bash
# Wait ~30s for the registry to propagate, then:
npx @pakbaz/specfleet@latest --version
# In a scratch dir:
mkdir /tmp/specfleet-postpub && cd /tmp/specfleet-postpub
npx @pakbaz/specfleet@latest init --non-interactive
ls .specfleet/charters | wc -l   # should be ≥ 8
```

## Troubleshooting

- **`E403 Forbidden` on publish** — the npm Trusted Publisher does not match
  `pakbaz/spec-fleet`, `release.yml`, or the `publish` environment.
- **`E402 Payment Required`** — `publishConfig.access` isn't `public` (it is, but
  if someone "fixes" it later, scoped packages default to private).
- **Provenance fails** — `id-token: write` is missing from the workflow's
  `permissions` block, or the workflow is running on a fork.
- **Smoke job fails in CI** — likely a real bug; the smoke job installs the
  packed tarball into a temp consumer and runs `specfleet init`. Read the job logs.
