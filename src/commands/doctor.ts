/**
 * `eas doctor` — Validate .eas/ integrity, charter caps, MCP scopes, and
 * presence of required files. Exits non-zero on hard failures.
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import chalk from "chalk";
import { findEasRoot, easPaths } from "../util/paths.js";
import { loadAllCharters } from "../runtime/charter.js";
import {
  loadEgressPolicy,
  loadIpGuardPolicy,
  loadTrustedSigners,
} from "../util/policies.js";
import { isOfflineMode } from "../runtime/policy.js";
import { hasSignature, verifyCharterSignature } from "../util/sign.js";

const HARD_CAP = 95_000;

export async function doctorCommand(): Promise<void> {
  let errors = 0;
  let warnings = 0;
  const fail = (m: string) => {
    console.log(chalk.red(`  ✖ ${m}`));
    errors++;
  };
  const warn = (m: string) => {
    console.log(chalk.yellow(`  ⚠ ${m}`));
    warnings++;
  };
  const ok = (m: string) => console.log(chalk.green(`  ✓ ${m}`));

  console.log(chalk.bold("EAS doctor"));
  let root: string;
  try {
    root = await findEasRoot();
  } catch (e) {
    console.log(chalk.red(`  ✖ ${(e as Error).message}`));
    process.exitCode = 2;
    return;
  }
  const p = easPaths(root);
  ok(`root: ${root}`);

  // Required files
  for (const [label, file] of [
    ["instruction.md", p.instruction],
    ["charters/", p.chartersDir],
  ] as const) {
    try {
      await fs.stat(file);
      ok(`exists: ${label}`);
    } catch {
      fail(`missing: ${label}`);
    }
  }

  // Charters
  try {
    const charters = await loadAllCharters(p.chartersDir);
    ok(`loaded ${charters.length} charter(s)`);
    const trusted = await loadTrustedSigners(p.policiesDir);
    let signedCount = 0;
    for (const c of charters) {
      if (c.maxContextTokens > HARD_CAP) fail(`${c.name}: maxContextTokens ${c.maxContextTokens} > hard cap ${HARD_CAP}`);
      if (c.allowedTools.length === 0 && c.tier !== "root") warn(`${c.name}: empty allowedTools (no scoping)`);
      for (const mcp of c.mcpServers) {
        const manifest = path.join(p.mcpDir, `${mcp}.json`);
        try {
          await fs.stat(manifest);
        } catch {
          fail(`${c.name}: mcpServer "${mcp}" has no manifest at ${manifest}`);
        }
      }
      for (const skill of c.skills) {
        const sk = path.join(p.skillsDir, `${skill}.md`);
        try {
          await fs.stat(sk);
        } catch {
          warn(`${c.name}: skill "${skill}" not found at ${sk}`);
        }
      }
      if (hasSignature(c)) {
        signedCount++;
        const v = verifyCharterSignature(c, trusted);
        if (!v.ok && v.reason === "no-trusted-signers") {
          warn(`${c.name}: charter is signed but .eas/policies/trusted-signers.json is absent`);
        } else if (!v.ok && v.reason === "not-implemented") {
          warn(`${c.name}: signature present (full verification lands in v0.3)`);
        }
      }
    }
    if (signedCount > 0) ok(`${signedCount} signed charter(s) detected`);
  } catch (e) {
    fail(`charters: ${(e as Error).message}`);
  }

  // Policy hooks
  try {
    const eg = await loadEgressPolicy(p.policiesDir);
    if (eg) {
      const total = eg.allow.length + (eg.deny?.length ?? 0);
      if (eg.allow.length === 0) warn(`egress policy present with empty allow list (deny-all external)`);
      ok(`egress policy loaded (${total} entries)`);
    } else {
      warn(`no egress policy at ${p.policiesDir}/egress.json (no enforcement)`);
    }
  } catch (e) {
    fail(`egress.json: ${(e as Error).message}`);
  }
  try {
    const ip = await loadIpGuardPolicy(p.policiesDir);
    if (ip) ok(`ip-guard policy loaded (${ip.patterns.length} pattern(s), mode=${ip.mode})`);
    else warn(`no ip-guard policy at ${p.policiesDir}/ip-guard.json (no enforcement)`);
  } catch (e) {
    fail(`ip-guard.json: ${(e as Error).message}`);
  }

  // Offline mode
  if (isOfflineMode()) {
    ok(`offline mode ENABLED (EAS_OFFLINE=1) — all egress will be denied`);
  } else {
    ok(`offline mode disabled (set EAS_OFFLINE=1 to deny all egress)`);
  }

  console.log("");
  if (errors > 0) {
    console.log(chalk.red(`✖ ${errors} error(s), ${warnings} warning(s)`));
    process.exitCode = 1;
  } else {
    console.log(chalk.green(`✓ healthy (${warnings} warning(s))`));
  }
}
