/**
 * `specfleet config` — inspect/edit workspace config + reflect on charters.
 *
 * Subcommands:
 *   show         print .specfleet/config.json
 *   set <k> <v>  set a dotted key (e.g. models.review=gpt-5.1)
 *   list         list charters / prompts / instructions / mcp manifests
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import chalk from "chalk";
import fg from "fast-glob";
import { Workspace, DEFAULT_CONFIG, ensureWorkspaceConfig } from "../runtime/workspace.js";
import { findSpecFleetRoot, specFleetPaths } from "../util/paths.js";

export interface ConfigOptions {
  key?: string;
  value?: string;
}

export async function configCommand(
  action: "show" | "set" | "list" | undefined,
  opts: ConfigOptions = {},
): Promise<void> {
  if (action === "set") {
    if (!opts.key || opts.value === undefined) {
      throw new Error('config set requires "key" and "value"');
    }
    await setConfigKey(opts.key, opts.value);
    return;
  }
  if (action === "list") {
    await listAll();
    return;
  }
  // default: show
  await showConfig();
}

async function showConfig(): Promise<void> {
  const root = await findSpecFleetRoot();
  const p = specFleetPaths(root);
  await ensureWorkspaceConfig(p.config);
  const ws = await Workspace.open();
  console.log(chalk.bold("config"));
  console.log(JSON.stringify(ws.config, null, 2));
}

async function setConfigKey(key: string, rawValue: string): Promise<void> {
  const root = await findSpecFleetRoot();
  const p = specFleetPaths(root);
  await ensureWorkspaceConfig(p.config);
  const raw = await fs.readFile(p.config, "utf8");
  const cfg = JSON.parse(raw) as Record<string, unknown>;
  setDotted(cfg, key, parseValue(rawValue));
  await fs.writeFile(p.config, JSON.stringify(cfg, null, 2) + "\n", "utf8");
  console.log(chalk.green(`✓ set ${key} = ${rawValue}`));
}

function parseValue(v: string): unknown {
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  if (v.startsWith("[") || v.startsWith("{")) {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
}

function setDotted(obj: Record<string, unknown>, key: string, value: unknown): void {
  const parts = key.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]!;
    if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1]!;
  cur[last] = value;
}

async function listAll(): Promise<void> {
  const ws = await Workspace.open();
  console.log(chalk.bold(`Charters (${ws.charters.length})`));
  for (const c of ws.charters) {
    console.log(`  ${chalk.cyan(c.name.padEnd(14))} ${c.description}`);
  }

  const prompts = await fg("specfleet.*.prompt.md", { cwd: ws.paths.githubPromptsDir });
  console.log(chalk.bold(`\nPrompts (${prompts.length})`));
  for (const f of prompts.sort()) console.log(`  ${path.basename(f)}`);

  const instructions = await fg("*.instructions.md", { cwd: ws.paths.githubInstructionsDir });
  console.log(chalk.bold(`\nInstructions (${instructions.length})`));
  for (const f of instructions.sort()) console.log(`  ${path.basename(f)}`);

  const mcp = await fg("*.json", { cwd: ws.paths.mcpDir });
  console.log(chalk.bold(`\nMCP servers (${mcp.length})`));
  for (const f of mcp.sort()) console.log(`  ${path.basename(f)}`);

  console.log(chalk.bold(`\nDefaults`));
  console.log(JSON.stringify(DEFAULT_CONFIG, null, 2));
}
