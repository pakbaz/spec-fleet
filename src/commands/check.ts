/**
 * `specfleet check` — health checks for a v0.6 workspace.
 *
 *   default            verifies charters parse, .github/agents/ mirrors are fresh,
 *                      Copilot CLI is reachable, MCP manifests parse JSON.
 *   --staged           runs the secrets scanner over staged files (pre-commit).
 *   --fix              re-mirrors charters into .github/agents/.
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import { execFileSync } from "node:child_process";
import chalk from "chalk";
import fg from "fast-glob";
import { Workspace } from "../runtime/workspace.js";
import { mirrorCharters } from "../runtime/charter.js";
import { probeCopilot } from "../runtime/dispatch.js";
import { findSecrets, loadCustomPatterns } from "../util/secrets.js";
import { findSpecFleetRoot, specFleetPaths } from "../util/paths.js";

export interface CheckOptions {
  staged?: boolean;
  fix?: boolean;
}

export async function checkCommand(opts: CheckOptions = {}): Promise<void> {
  if (opts.staged) {
    await stagedSecretsScan();
    return;
  }

  let failures = 0;
  const ws = await Workspace.open();
  console.log(chalk.bold(`SpecFleet @ ${ws.root}`));

  // 1. Charters
  console.log(chalk.bold(`\nCharters`));
  for (const c of ws.charters) {
    console.log(
      `  ${chalk.cyan(c.name.padEnd(14))}  cap=${c.maxContextTokens}  tools=${c.allowedTools.length}  mcp=${c.mcpServers.length}`,
    );
  }
  if (ws.charters.length < 3) {
    console.log(chalk.yellow(`  ⚠ only ${ws.charters.length} charter(s); expected at least 3`));
    failures++;
  }

  // 2. Mirror freshness
  const mirrored = await fs
    .readdir(ws.paths.githubAgentsDir)
    .catch(() => [] as string[]);
  const wanted = new Set(ws.charters.map((c) => `${c.name}.agent.md`));
  const missing = [...wanted].filter((f) => !mirrored.includes(f));
  if (missing.length > 0) {
    console.log(chalk.yellow(`  ⚠ missing mirrors in .github/agents/: ${missing.join(", ")}`));
    if (opts.fix) {
      await mirrorCharters(ws.charters, ws.paths.githubAgentsDir);
      console.log(chalk.green(`  ✓ re-mirrored charters`));
    } else {
      failures++;
    }
  }

  // 3. Copilot CLI
  console.log(chalk.bold(`\nCopilot CLI`));
  const probe = probeCopilot();
  if (probe.ok) {
    console.log(`  ${chalk.green("✓")} ${probe.version}`);
  } else {
    console.log(`  ${chalk.red("✗")} not reachable: ${probe.error ?? "unknown"}`);
    failures++;
  }

  // 4. MCP manifests
  console.log(chalk.bold(`\nMCP manifests`));
  const mcpFiles = await fg("*.json", { cwd: ws.paths.mcpDir, absolute: true });
  for (const f of mcpFiles) {
    try {
      JSON.parse(await fs.readFile(f, "utf8"));
      console.log(`  ${chalk.green("✓")} ${path.basename(f)}`);
    } catch (e) {
      console.log(`  ${chalk.red("✗")} ${path.basename(f)}: ${(e as Error).message}`);
      failures++;
    }
  }

  // 5. Prompts
  console.log(chalk.bold(`\nPrompts`));
  const phases = ["specify", "clarify", "plan", "tasks", "analyze", "implement", "review", "checklist"];
  for (const p of phases) {
    const f = path.join(ws.paths.githubPromptsDir, `specfleet.${p}.prompt.md`);
    try {
      await fs.access(f);
      console.log(`  ${chalk.green("✓")} ${p}`);
    } catch {
      console.log(`  ${chalk.red("✗")} missing prompt: specfleet.${p}.prompt.md`);
      failures++;
    }
  }

  if (failures === 0) {
    console.log(chalk.green(`\n✓ All checks passed`));
  } else {
    console.log(chalk.red(`\n✗ ${failures} check(s) failed`));
    process.exitCode = 1;
  }
}

async function stagedSecretsScan(): Promise<void> {
  const root = await findSpecFleetRoot().catch(() => process.cwd());
  const p = specFleetPaths(root);
  await loadCustomPatterns(p.policiesDir);

  let stagedFiles: string[] = [];
  try {
    const out = execFileSync("git", ["diff", "--cached", "--name-only", "-z"], {
      cwd: root,
      encoding: "utf8",
    });
    stagedFiles = out.split("\0").filter(Boolean);
  } catch {
    console.log(chalk.gray("  (not a git repo or no staged files)"));
    return;
  }
  if (stagedFiles.length === 0) {
    console.log(chalk.gray("  (no staged files)"));
    return;
  }

  let hits = 0;
  for (const rel of stagedFiles) {
    const abs = path.join(root, rel);
    let content: string;
    try {
      content = await fs.readFile(abs, "utf8");
    } catch {
      continue; // binary or deleted
    }
    const matches = findSecrets(content);
    for (const m of matches) {
      hits++;
      console.log(`${chalk.red("✗")} ${rel}: ${m.rule} (${m.preview})`);
    }
  }
  if (hits > 0) {
    console.log(chalk.red(`\n✗ ${hits} potential secret(s) in staged files`));
    process.exitCode = 1;
  } else {
    console.log(chalk.green(`✓ no secrets detected in ${stagedFiles.length} staged file(s)`));
  }
}
