# Releasing SpecFleet

<!-- markdownlint-disable MD031 MD060 -->
This document is for **maintainers** cutting a new release of the SpecFleet
**Spec Kit extension**.

SpecFleet is distributed the same way as any other
[Spec Kit](https://github.com/github/spec-kit) extension — as a tagged GitHub
release that users install with `specify extension add`. There is **no npm
publish step**: the extension is the manifest (`extension.yml`) plus the
`commands/` files, and ships straight from the Git tag.

End users install it with:

```bash
specify extension add specfleet \
  --from https://github.com/pakbaz/spec-fleet/archive/refs/tags/vX.Y.Z.zip
```

## Versioning policy

We follow [Semantic Versioning](https://semver.org/):

| Bump | When |
|---|---|
| **MAJOR** (`1.0.0 → 2.0.0`) | Breaking change to a command, charter schema, or `.specfleet/` layout |
| **MINOR** (`0.1.0 → 0.2.0`) | New command, new charter type, new template, additive policy field |
| **PATCH** (`0.1.0 → 0.1.1`) | Bug fix, doc fix, dependency bump that doesn't change behaviour |

While we're on `0.x`, *every* release may technically break things — we still
try to honour the table above and call out breaks in `CHANGELOG.md`.

Keep `extension.yml#extension.version` and `package.json#version` in sync (CI
enforces docs/version drift via `npm run version:sync`).

## Cutting a release

```bash
# 1. Make sure main is green and you're on it
git switch main && git pull

# 2. Bump version + write changelog (does NOT publish anywhere)
npm version patch   # or minor / major / 0.2.0-rc.1
$EDITOR CHANGELOG.md

# 3. Commit the changelog edit into the version commit
git add CHANGELOG.md
git commit --amend --no-edit
git push --follow-tags
```

`npm version` creates the `vX.Y.Z` tag and runs `version:sync` so the README and
docs reflect the new version. Pushing the tag is all that's required — GitHub
automatically serves the source archive at
`https://github.com/pakbaz/spec-fleet/archive/refs/tags/vX.Y.Z.zip`, which is the
URL users pass to `specify extension add --from`.

Optionally, publish a GitHub Release for the tag (Releases → Draft a new release
→ pick the tag → paste the `CHANGELOG.md` section) so the version shows up under
the repo's Releases tab. The downloadable source archive is what the extension
installer consumes.

## Verifying a release

Before announcing, confirm the tagged archive installs cleanly:

```bash
# Install the tagged extension into a scratch Spec Kit project
specify extension add specfleet \
  --from https://github.com/pakbaz/spec-fleet/archive/refs/tags/vX.Y.Z.zip
specify extension list            # → specfleet (X.Y.Z) — SpecFleet
```

The `ci` workflow ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml))
already builds, tests, and validates the extension manifest on every push and PR,
including [`tests/unit/extension.test.ts`](../tests/unit/extension.test.ts) which
checks Spec Kit compatibility (manifest schema, command files, and required
Spec Kit core commands).

## Hot-fixing a bad release

1. Cut a new patch tag (`vX.Y.Z+1`) with the fix and call it out in
   `CHANGELOG.md`.
2. Point users at the new archive URL. Because installs are pinned to a tag, a
   bad tag simply stops being referenced — there is nothing to unpublish.
3. If a GitHub Release was created for the bad tag, mark it as a pre-release or
   delete it so the latest release points at the good version.
