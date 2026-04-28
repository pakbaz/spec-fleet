#!/usr/bin/env node
/**
 * verify:no-telemetry — fails CI if any built artifact references a known
 * 3rd-party telemetry / analytics host. Run AFTER `npm run build`.
 *
 * Zero-dep on purpose: just Node stdlib so this can run in any minimal CI image.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FORBIDDEN = [
  "google-analytics.com",
  "googleanalytics.com",
  "segment.io",
  "mixpanel.com",
  "amplitude.com",
  "sentry.io",
  "posthog.com",
  "datadoghq.com",
  "datadog.com",
  "newrelic.com",
];

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const distDir = path.join(repoRoot, "dist");

async function* walk(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile() && (p.endsWith(".js") || p.endsWith(".mjs") || p.endsWith(".cjs"))) yield p;
  }
}

const violations = [];
for await (const file of walk(distDir)) {
  const text = await fs.readFile(file, "utf8");
  for (const host of FORBIDDEN) {
    const idx = text.indexOf(host);
    if (idx !== -1) {
      violations.push({
        file: path.relative(repoRoot, file),
        host,
        snippet: text.slice(Math.max(0, idx - 20), idx + host.length + 20),
      });
    }
  }
}

if (violations.length > 0) {
  console.error(`\u2716 verify:no-telemetry — found ${violations.length} forbidden reference(s):`);
  for (const v of violations) {
    console.error(`  ${v.file}: ${v.host}`);
    console.error(`    ...${v.snippet.replace(/\n/g, " ")}...`);
  }
  process.exit(1);
}

console.log(`\u2713 verify:no-telemetry — clean (${FORBIDDEN.length} hosts checked)`);
