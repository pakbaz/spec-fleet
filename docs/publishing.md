# Publishing `@pakbaz/eas`

This document is for **maintainers** cutting a new release of the EAS CLI to
[npmjs.com](https://www.npmjs.com/package/@pakbaz/eas).

End users do not need any of this — they install with `npm i -g @pakbaz/eas`.

## Versioning policy

We follow [Semantic Versioning](https://semver.org/):

| Bump | When |
|---|---|
| **MAJOR** (`1.0.0 → 2.0.0`) | Breaking change to a CLI flag, charter schema, or `.eas/` layout |
| **MINOR** (`0.1.0 → 0.2.0`) | New command, new charter type, new template, additive policy field |
| **PATCH** (`0.1.0 → 0.1.1`) | Bug fix, doc fix, dependency bump that doesn't change behaviour |

While we're on `0.x`, *every* release may technically break things — we still
try to honour the table above and call out breaks in `CHANGELOG.md`.

## One-time setup (per maintainer)

The npm scope `@pakbaz` is owned by the **`pakbaz` organization** on npmjs.com.
Maintainers publish using their personal npm account (e.g. `pakbaz82`) which
must be a member of that org with **Developer** or higher rights.

1. **Confirm org membership.** `npm org ls pakbaz` should list your username.
   If not, an org admin must invite you at
   <https://www.npmjs.com/settings/pakbaz/members>.
2. **Generate an automation `NPM_TOKEN`** at
   <https://www.npmjs.com/settings/~/tokens/granular-access-tokens> (`~`
   resolves to your logged-in user, currently `pakbaz82`):
   - Type: **Granular access token**
   - Packages and scopes: **Read and write** for `@pakbaz/*`
   - Check **Bypass two-factor authentication when publishing** (lets CI publish
     non-interactively)
   - Expiration: 90 days (rotate on calendar)
3. **Add it as a repo secret:** GitHub → Settings → Secrets and variables →
   Actions → `NPM_TOKEN`. Make it part of the `npm-publish` environment so
   tagged-release runs require an environment approval.
4. **Confirm 2FA mode is `auth-only`** (npmjs.com → settings → 2FA). Combined
   with the bypass-2fa flag on the automation token, this lets the CI publish
   while still requiring OTP for sensitive account operations.

## Cutting a release

### Local publish (manual, requires interactive OTP)

```bash
# 1. Make sure main is green and you're on it
git switch main && git pull

# 2. Publish — provenance is OFF locally (only works in CI with OIDC)
cd /path/to/enterprise-agents-system
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
   npm deprecate @pakbaz/eas@0.1.3 "Critical bug in eas init; use 0.1.4+"
   ```
3. Cut a `0.1.4` patch with the fix and call it out in `CHANGELOG.md`.

## Smoke check after publishing

```bash
# Wait ~30s for the registry to propagate, then:
npx @pakbaz/eas@latest --version
# In a scratch dir:
mkdir /tmp/eas-postpub && cd /tmp/eas-postpub
npx @pakbaz/eas@latest init --non-interactive
ls .eas/charters | wc -l   # should be ≥ 8
```

## Troubleshooting

- **`E403 Forbidden` on publish** — `NPM_TOKEN` lacks write scope on `@pakbaz/eas`,
  or the token expired.
- **`E402 Payment Required`** — `publishConfig.access` isn't `public` (it is, but
  if someone "fixes" it later, scoped packages default to private).
- **Provenance fails** — `id-token: write` is missing from the workflow's
  `permissions` block, or the workflow is running on a fork.
- **Smoke job fails in CI** — likely a real bug; the smoke job installs the
  packed tarball into a temp consumer and runs `eas init`. Read the job logs.
