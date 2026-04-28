/**
 * `eas doctor` — Validate .eas/ integrity, charter caps, MCP scopes, and
 * presence of required files. Exits non-zero on hard failures.
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import chalk from "chalk";
import { findEasRoot, easPaths } from "../util/paths.js";
import { loadAllCharters } from "../runtime/charter.js";

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
    }
  } catch (e) {
    fail(`charters: ${(e as Error).message}`);
  }

  console.log("");
  if (errors > 0) {
    console.log(chalk.red(`✖ ${errors} error(s), ${warnings} warning(s)`));
    process.exitCode = 1;
  } else {
    console.log(chalk.green(`✓ healthy (${warnings} warning(s))`));
  }
}
