/**
 * `specfleet init` — v0.6 bootstrap. Detects the repo state (greenfield /
 * brownfield / upgrade) and seeds `.specfleet/` + `.github/` from the
 * bundled templates. v0.6 dropped the guided-interview step; the constitution
 * is a small file the user (or an LLM via `specify`) edits as work proceeds.
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";
import chalk from "chalk";
import { ensureDir, specFleetPaths, readMaybe } from "../util/paths.js";
import { ensureWorkspaceConfig } from "../runtime/workspace.js";
import { mirrorCharters, loadAllCharters } from "../runtime/charter.js";
import { probeCopilot } from "../runtime/dispatch.js";

export type InitMode = "greenfield" | "brownfield" | "upgrade" | "overwrite";

export interface InitOptions {
  dir?: string;
  nonInteractive?: boolean;
  instruction?: string;
  mode?: InitMode;
  force?: boolean;
  fromV5?: boolean;
}

const __filename = fileURLToPath(import.meta.url);
// dist/commands/init.js -> ../../templates
const TEMPLATES_DIR = path.resolve(path.dirname(__filename), "..", "..", "templates");
const SPEC_FLEET_TEMPLATE_ENTRIES = ["charters", "mcp", "skills", "instruction.md", "project.md"];

const CODE_MARKERS = [
  "package.json",
  "pyproject.toml",
  "go.mod",
  "pom.xml",
  "Cargo.toml",
  "build.gradle",
  "build.gradle.kts",
  "Gemfile",
  "composer.json",
];

export async function initCommand(opts: InitOptions): Promise<void> {
  const root = path.resolve(opts.dir ?? process.cwd());
  const p = specFleetPaths(root);

  if (opts.fromV5) {
    await migrateFromV5(root, p);
    return;
  }

  const state = await detectState(root);
  const mode = await chooseMode(state, opts);
  console.log(chalk.cyan(`▸ Initializing SpecFleet in ${root} (mode: ${mode})`));

  if (mode === "overwrite") {
    if (!opts.force) throw new Error("--mode overwrite requires --force");
    await fs.rm(p.specFleetDir, { recursive: true, force: true });
    await fs.rm(p.githubAgentsDir, { recursive: true, force: true });
    await fs.rm(p.githubPromptsDir, { recursive: true, force: true });
    await fs.rm(p.githubInstructionsDir, { recursive: true, force: true });
  }

  await scaffoldTemplates(p);
  await ensureWorkspaceConfig(p.config);

  if (opts.instruction) {
    await applyCustomInstruction(opts.instruction, p.instruction);
  }

  const charters = await loadAllCharters(p.chartersDir);
  await mirrorCharters(charters, p.githubAgentsDir);
  console.log(chalk.gray(`  mirrored ${charters.length} charter(s) to .github/agents/`));

  // Surface a clear next-step that depends on whether copilot is reachable.
  const probe = probeCopilot();
  if (!probe.ok) {
    console.log(
      chalk.yellow(
        `  ⚠ Copilot CLI not detected on $PATH. Install it before running phase commands.`,
      ),
    );
  } else {
    console.log(chalk.gray(`  Copilot CLI detected: ${probe.version}`));
  }

  console.log(
    chalk.green(
      `✓ Initialized (${mode}). Next: specfleet specify "<feature name>" --description "<one-liner>"`,
    ),
  );
}

interface RepoState {
  hasSpecFleet: boolean;
  hasLegacyEas: boolean;
  hasV5Layout: boolean;
  hasCode: boolean;
  isEmpty: boolean;
}

async function detectState(root: string): Promise<RepoState> {
  const hasSpecFleet = await pathExists(path.join(root, ".specfleet"));
  const hasLegacyEas = await pathExists(path.join(root, ".eas"));
  // v0.5 stored hash-chained audit and policies; treat as upgradeable.
  const hasV5Layout =
    hasSpecFleet && (await pathExists(path.join(root, ".specfleet", "audit")));
  let hasCode = false;
  for (const m of CODE_MARKERS) {
    if (await pathExists(path.join(root, m))) {
      hasCode = true;
      break;
    }
  }
  let isEmpty = false;
  try {
    const entries = await fs.readdir(root);
    const meaningful = entries.filter(
      (e) => e !== ".git" && e !== ".DS_Store" && !e.startsWith(".specfleet") && !e.startsWith(".eas"),
    );
    isEmpty = meaningful.length === 0;
  } catch {
    isEmpty = true;
  }
  return { hasSpecFleet, hasLegacyEas, hasV5Layout, hasCode, isEmpty };
}

async function chooseMode(state: RepoState, opts: InitOptions): Promise<InitMode> {
  if (opts.mode) return opts.mode;
  if (opts.nonInteractive) {
    if (state.hasSpecFleet) return "upgrade";
    return state.hasCode ? "brownfield" : "greenfield";
  }
  if (state.isEmpty) return "greenfield";
  if (state.hasSpecFleet) {
    return promptOne("`.specfleet/` already exists. What would you like to do?", [
      { value: "upgrade", label: "upgrade — refresh templates, keep my charters/specs (default)" },
      { value: "overwrite", label: "overwrite — full reset (requires --force)" },
      { value: "cancel", label: "cancel" },
    ], "upgrade");
  }
  if (state.hasCode) return "brownfield";
  return "greenfield";
}

type ChoiceValue = InitMode | "cancel";

async function promptOne(
  question: string,
  choices: Array<{ value: ChoiceValue; label: string }>,
  defaultValue: InitMode,
): Promise<InitMode> {
  if (!process.stdin.isTTY) return defaultValue;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log(chalk.bold(`\n${question}`));
    for (const c of choices) console.log(`  • ${chalk.cyan(c.value)} — ${c.label}`);
    const ans = (await rl.question(chalk.gray(`  [${defaultValue}]> `))).trim();
    if (!ans) return defaultValue;
    const m = choices.find((c) => c.value === ans);
    if (!m) {
      console.log(chalk.yellow(`  unrecognized: "${ans}", using default (${defaultValue})`));
      return defaultValue;
    }
    if (m.value === "cancel") throw new Error("init cancelled by user");
    return m.value;
  } finally {
    rl.close();
  }
}

async function scaffoldTemplates(p: ReturnType<typeof specFleetPaths>): Promise<void> {
  await ensureDir(p.specFleetDir);
  // Copy only current v0.6 `.specfleet/` templates. Historical policy packs,
  // benchmarks, decisions, and old spec templates stay in git history/docs.
  for (const entry of SPEC_FLEET_TEMPLATE_ENTRIES) {
    await copyTemplateEntry(path.join(TEMPLATES_DIR, entry), path.join(p.specFleetDir, entry));
  }
  // Then copy `.github/` into the repo root.
  const sourceGithub = path.join(TEMPLATES_DIR, ".github");
  if (await pathExists(sourceGithub)) {
    await copyDirRecursive(sourceGithub, p.githubDir);
  }
  for (const d of [p.specsDir, p.scratchpadDir, p.runsDir]) {
    await ensureDir(d);
    await fs.writeFile(path.join(d, ".gitkeep"), "", "utf8").catch(() => {});
  }
}

async function applyCustomInstruction(srcArg: string, dst: string): Promise<void> {
  const src = path.resolve(srcArg);
  const st = await fs.lstat(src);
  if (st.isSymbolicLink()) throw new Error(`--instruction must not be a symlink: ${src}`);
  if (!st.isFile()) throw new Error(`--instruction must point to a regular file: ${src}`);
  await fs.copyFile(src, dst);
  console.log(chalk.gray(`  copied corporate instruction from ${src}`));
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

interface CopyOptions {
  skip?: string[];
}

async function copyDirRecursive(src: string, dst: string, opts: CopyOptions = {}): Promise<void> {
  await ensureDir(dst);
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    if (opts.skip?.includes(e.name)) continue;
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) {
      await copyDirRecursive(s, d);
    } else {
      try {
        await fs.stat(d);
      } catch {
        await fs.copyFile(s, d);
      }
    }
  }
}

async function copyTemplateEntry(src: string, dst: string): Promise<void> {
  const st = await fs.stat(src);
  if (st.isDirectory()) {
    await copyDirRecursive(src, dst);
    return;
  }
  try {
    await fs.stat(dst);
  } catch {
    await ensureDir(path.dirname(dst));
    await fs.copyFile(src, dst);
  }
}

async function migrateFromV5(root: string, p: ReturnType<typeof specFleetPaths>): Promise<void> {
  console.log(chalk.cyan(`▸ Migrating SpecFleet 0.5 → 0.6 in ${root}`));
  // The v0.5 → v0.6 migration is intentionally minimal: archive the old
  // SDK-coupled artefacts so they don't confuse the new runtime, then
  // re-scaffold the v0.6 templates in place.
  const archive = path.join(p.specFleetDir, "_v5-archive");
  await ensureDir(archive);
  for (const f of ["audit", "checkpoints", "index", "plans", "instruction.md"]) {
    const from = path.join(p.specFleetDir, f);
    const to = path.join(archive, f);
    if (await pathExists(from)) {
      await fs.rename(from, to).catch(() => {});
    }
  }
  await scaffoldTemplates(p);
  await ensureWorkspaceConfig(p.config);
  const charters = await loadAllCharters(p.chartersDir);
  await mirrorCharters(charters, p.githubAgentsDir);
  console.log(
    chalk.green(
      `✓ Migrated. Old artefacts archived under .specfleet/_v5-archive/ — review and delete when ready.`,
    ),
  );
}

// Suppress unused warnings for helpers reserved for future flag handling.
void readMaybe;
