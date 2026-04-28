#!/usr/bin/env node
// Keep docs/README in sync with package.json version.
// Run automatically via the `version` npm lifecycle so `npm version <X.Y.Z>`
// updates docs in the same commit. Also runnable as `npm run version:sync`.
//
// Targets specific, predictable patterns. If you add a new doc that mentions
// the version literally, register the pattern here OR use the marker form:
//   <!-- x-version -->0.4.1<!-- /x-version -->
// Markers are auto-rewritten regardless of file path (any *.md under repo).

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

const pkg = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
const version = pkg.version;
if (!/^\d+\.\d+\.\d+/.test(version)) {
  console.error(`[sync-docs-version] invalid version in package.json: ${version}`);
  process.exit(1);
}

// Pattern targets — keep this list small and intentional.
const targets = [
  {
    file: "docs/quickstart.md",
    // matches:  specfleet --version          # → 0.4.0
    pattern: /(specfleet --version\s+#\s*→\s*)\d+\.\d+\.\d+/g,
    replace: `$1${version}`,
  },
];

const changed = [];

for (const t of targets) {
  const path = resolve(repoRoot, t.file);
  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    continue;
  }
  const next = content.replace(t.pattern, t.replace);
  if (next !== content) {
    writeFileSync(path, next);
    changed.push(t.file);
  }
}

// Marker pass: any markdown file with <!-- x-version -->X.Y.Z<!-- /x-version -->.
// Use execFileSync with an argv array — never shell-interpolate user-controlled
// strings. Construct a fresh regex inside the loop so /g lastIndex state from
// earlier files cannot leak into later ones.
let allMd;
try {
  allMd = execFileSync("git", ["ls-files", "*.md"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);
} catch (err) {
  // Not a git repo, or git missing. Markers can still be edited manually; just
  // skip this pass rather than crashing the version bump.
  console.warn(`[sync-docs-version] skipping marker pass: ${err.message}`);
  allMd = [];
}

for (const rel of allMd) {
  const path = resolve(repoRoot, rel);
  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    continue;
  }
  // Tighten the inner content match to a SemVer-shaped literal (digits + dots
  // + optional prerelease/build). This way doc examples that show the marker
  // with placeholders like X.Y.Z are not rewritten — only real version
  // literals are touched.
  const markerRe =
    /(<!--\s*x-version\s*-->)\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?(<!--\s*\/x-version\s*-->)/g;
  const next = content.replace(markerRe, `$1${version}$2`);
  if (next !== content) {
    writeFileSync(path, next);
    if (!changed.includes(rel)) changed.push(rel);
  }
}

if (changed.length === 0) {
  console.log(`[sync-docs-version] all docs already at ${version}`);
} else {
  console.log(`[sync-docs-version] synced ${changed.length} file(s) to ${version}:`);
  for (const f of changed) console.log(`  - ${f}`);
}

// When run from the npm `version` lifecycle, stage the changes so they land
// in the version commit npm is about to make. Pass paths as argv (never shell
// interpolation) so filenames containing $, backticks, or quotes are safe.
if (process.env.npm_lifecycle_event === "version" && changed.length > 0) {
  try {
    execFileSync("git", ["add", "--", ...changed], {
      cwd: repoRoot,
      stdio: "inherit",
    });
  } catch (err) {
    console.warn(`[sync-docs-version] git add failed: ${err.message}`);
  }
}
