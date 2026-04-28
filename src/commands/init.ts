/**
 * `specfleet init` — v0.4 unified bootstrap. Detects on-disk state and offers:
 *
 *   • greenfield  — empty repo, scaffold templates + run guided interview
 *   • brownfield  — code present, no .specfleet/, scaffold + analyze + draft project.md
 *   • modify      — code present, no .specfleet/, scaffold without analysis (bare)
 *   • upgrade     — .specfleet/ exists, refresh templates non-destructively
 *                  or legacy .eas/ exists, migrate it to .specfleet/
 *   • overwrite   — .specfleet/ exists, full reset (requires --force)
 *
 * Always installs the git pre-commit hook when `.git/` is present, unless
 * `--no-hooks` is passed.
 *
 * Backward compatible: existing tests that call `initCommand({ dir, nonInteractive: true })`
 * against an empty tmpdir still get the v0.2 greenfield behaviour (templates copied,
 * charters mirrored, no interview, no prompt).
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";
import chalk from "chalk";
import { ensureDir, specFleetPaths, readMaybe } from "../util/paths.js";
import { mirrorCharters, loadAllCharters } from "../runtime/charter.js";
import { runInterview } from "../runtime/interview.js";

export type InitMode = "greenfield" | "brownfield" | "modify" | "upgrade" | "overwrite";

export interface InitOptions {
  dir?: string;
  nonInteractive?: boolean;
  instruction?: string;
  mode?: InitMode;
  force?: boolean;
  noHooks?: boolean;
  hooksOnly?: boolean;
}

const __filename = fileURLToPath(import.meta.url);
// dist/commands/init.js -> ../../templates
const TEMPLATES_DIR = path.resolve(path.dirname(__filename), "..", "..", "templates");

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

  // --hooks-only is a fast-path for `specfleet init --hooks-only` callers.
  if (opts.hooksOnly) {
    const { installHooksCommand } = await import("./install-hooks.js");
    await installHooksCommand({ dir: root, force: opts.force });
    return;
  }

  // 1. Detect state.
  const state = await detectState(root);
  const mode = await chooseMode(state, opts);

  console.log(chalk.cyan(`▸ Initializing SpecFleet in ${root}  (mode: ${mode})`));

  // 2. Branch on mode.
  if (mode === "overwrite") {
    if (!opts.force) {
      throw new Error("--mode overwrite requires --force (it will delete .specfleet/)");
    }
    await fs.rm(p.specFleetDir, { recursive: true, force: true });
    await scaffoldTemplates(p);
  } else if (mode === "upgrade") {
    await migrateLegacyEas(root, p);
    // Refresh bundled templates non-destructively. User-edited charters/specs/audit
    // are preserved (copyDirRecursive skips files that already exist).
    await scaffoldTemplates(p);
  } else if (mode === "brownfield") {
    // Defer to onboard for code-walking + project.md drafting (it also does
    // the template copy non-destructively and mirrors charters).
    const { onboardCommand } = await import("./onboard.js");
    await onboardCommand({ dir: root });
  } else {
    // greenfield | modify
    await scaffoldTemplates(p);
  }

  // 3. Custom instruction.md (allowed in any mode that wrote templates).
  if (opts.instruction && mode !== "brownfield") {
    await applyCustomInstruction(opts.instruction, p.instruction);
  } else if (opts.instruction && mode === "brownfield") {
    // onboardCommand already copied templates; apply on top.
    await applyCustomInstruction(opts.instruction, p.instruction);
  }

  // 4. Mirror charters (brownfield already did, but it's idempotent).
  if (mode !== "brownfield") {
    const charters = await loadAllCharters(p.chartersDir);
    await mirrorCharters(charters, p.githubAgentsDir);
    console.log(chalk.gray(`  mirrored ${charters.length} charter(s) to .github/agents/`));
  }

  // 5. Install git hook unless suppressed.
  if (!opts.noHooks) {
    const hasGit = await pathExists(path.join(root, ".git"));
    if (hasGit) {
      try {
        const { installHooksCommand } = await import("./install-hooks.js");
        await installHooksCommand({ dir: root, force: false });
      } catch (e) {
        console.log(chalk.yellow(`  ⚠ skipped pre-commit hook: ${(e as Error).message}`));
      }
    } else {
      console.log(chalk.gray(`  no .git/ — skipping pre-commit hook install`));
    }
  }

  // 6. Guided interview (only on greenfield + interactive).
  if (mode === "greenfield" && !opts.nonInteractive) {
    console.log(chalk.cyan(`▸ Running Architect guided interview…`));
    await runInterview(root);
  } else if (mode === "greenfield") {
    console.log(chalk.gray(`  skipped guided interview (--non-interactive)`));
  }

  // 7. Friendly next-step.
  const next =
    mode === "upgrade"
      ? "specfleet check"
      : mode === "brownfield"
        ? "review .specfleet/project.md, then `specfleet review`"
        : 'specfleet plan "<your goal>"';
  console.log(chalk.green(`✓ Initialized (${mode}). Next: ${next}`));
}

// -- state detection ---------------------------------------------------------

interface RepoState {
  hasSpecFleet: boolean;
  hasLegacyEas: boolean;
  hasCode: boolean;
  isEmpty: boolean;
}

async function detectState(root: string): Promise<RepoState> {
  const hasSpecFleet = await pathExists(path.join(root, ".specfleet"));
  const hasLegacyEas = await pathExists(path.join(root, ".eas"));
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
  return { hasSpecFleet, hasLegacyEas, hasCode, isEmpty };
}

async function chooseMode(state: RepoState, opts: InitOptions): Promise<InitMode> {
  // Explicit flag wins.
  if (opts.mode) return opts.mode;

  // Non-interactive defaults — these match v0.2 behaviour for the existing
  // test fixtures (empty tmpdir → greenfield, no prompts).
  if (opts.nonInteractive) {
    if (state.hasSpecFleet || state.hasLegacyEas) return "upgrade";
    return "greenfield";
  }

  // Unambiguous fast-paths.
  if (state.isEmpty) return "greenfield";

  // Ambiguous — prompt.
  if (state.hasSpecFleet || state.hasLegacyEas) {
    return promptOne(
      state.hasLegacyEas && !state.hasSpecFleet
        ? "Legacy .eas/ exists. What would you like to do?"
        : ".specfleet/ already exists. What would you like to do?",
      [
        {
          value: "upgrade",
          label: state.hasLegacyEas && !state.hasSpecFleet
            ? "upgrade — migrate .eas/ to .specfleet/ and refresh templates (default)"
            : "upgrade — refresh templates, keep my charters/specs/audit (default)",
        },
        { value: "overwrite", label: "overwrite — full reset (requires --force)" },
        { value: "cancel", label: "cancel" },
      ],
      "upgrade",
    );
  }

  if (state.hasCode) {
    return promptOne(
      "Existing code detected. Choose init mode:",
      [
        { value: "brownfield", label: "brownfield — analyze + scaffold (recommended)" },
        { value: "modify", label: "modify — bare scaffold, no analysis" },
        { value: "cancel", label: "cancel" },
      ],
      "brownfield",
    );
  }

  return "greenfield";
}

type ChoiceValue = InitMode | "cancel";

async function promptOne(
  question: string,
  choices: Array<{ value: ChoiceValue; label: string }>,
  defaultValue: InitMode,
): Promise<InitMode> {
  // Test escape hatch — same pattern as runtime/interview.ts.
  const envAnswer = process.env.SPECFLEET_INIT_MODE;
  if (envAnswer) {
    const m = choices.find((c) => c.value === envAnswer);
    if (m && m.value !== "cancel") return m.value;
  }
  // No TTY → silent default.
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
    if (m.value === "cancel") {
      throw new Error("init cancelled by user");
    }
    return m.value;
  } finally {
    rl.close();
  }
}

// -- helpers -----------------------------------------------------------------

async function scaffoldTemplates(p: ReturnType<typeof specFleetPaths>): Promise<void> {
  await ensureDir(p.specFleetDir);
  await copyDirRecursive(TEMPLATES_DIR, p.specFleetDir);
  for (const d of [p.auditDir, p.checkpointsDir, p.indexDir, p.plansDir]) {
    await ensureDir(d);
    await fs.writeFile(path.join(d, ".gitkeep"), "", "utf8").catch(() => {});
  }
}

async function migrateLegacyEas(root: string, p: ReturnType<typeof specFleetPaths>): Promise<void> {
  const legacy = path.join(root, ".eas");
  if (!(await pathExists(legacy)) || (await pathExists(p.specFleetDir))) return;
  await ensureDir(p.specFleetDir);
  await copyDirRecursive(legacy, p.specFleetDir);
  console.log(chalk.gray(`  migrated .eas/ to .specfleet/ (legacy directory left in place)`));
}

async function applyCustomInstruction(srcArg: string, dst: string): Promise<void> {
  const src = path.resolve(srcArg);
  // lstat (not stat) so we don't follow a symlink to a sensitive file.
  const st = await fs.lstat(src);
  if (st.isSymbolicLink()) {
    throw new Error(`--instruction must not be a symlink: ${src}`);
  }
  if (!st.isFile()) {
    throw new Error(`--instruction must point to a regular file: ${src}`);
  }
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

async function copyDirRecursive(src: string, dst: string): Promise<void> {
  await ensureDir(dst);
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) {
      await copyDirRecursive(s, d);
    } else {
      // Don't overwrite existing files (idempotent re-init).
      try {
        await fs.stat(d);
      } catch {
        await fs.copyFile(s, d);
      }
    }
  }
}

// Suppress "unused" warnings for helpers we may grow into later.
void readMaybe;
