/**
 * `eas init` — Bootstrap a greenfield project's .eas/ directory.
 *
 *  1. Copy templates/ into <dir>/.eas/
 *  2. If --instruction <path> is provided, replace the sample instruction.md
 *  3. Mirror charters to .github/agents/
 *  4. If interactive, run the Architect interviewer subagent to generate project.md
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { ensureDir, easPaths } from "../util/paths.js";
import { mirrorCharters, loadAllCharters } from "../runtime/charter.js";
import { runInterview } from "../runtime/interview.js";

interface InitOptions {
  dir?: string;
  nonInteractive?: boolean;
  instruction?: string;
}

const __filename = fileURLToPath(import.meta.url);
// dist/commands/init.js -> ../../templates
const TEMPLATES_DIR = path.resolve(path.dirname(__filename), "..", "..", "templates");

export async function initCommand(opts: InitOptions): Promise<void> {
  const root = path.resolve(opts.dir ?? process.cwd());
  const p = easPaths(root);

  console.log(chalk.cyan(`▸ Initializing EAS in ${root}`));

  // 1. Copy templates → .eas/
  await ensureDir(p.easDir);
  await copyDirRecursive(TEMPLATES_DIR, p.easDir);

  // Audit/checkpoints/index dirs are gitignored content; create + .gitkeep
  for (const d of [p.auditDir, p.checkpointsDir, p.indexDir, p.plansDir]) {
    await ensureDir(d);
    await fs.writeFile(path.join(d, ".gitkeep"), "", "utf8").catch(() => {});
  }

  // 2. Custom instruction.md
  if (opts.instruction) {
    const src = path.resolve(opts.instruction);
    await fs.copyFile(src, p.instruction);
    console.log(chalk.gray(`  copied corporate instruction from ${src}`));
  }

  // 3. Mirror charters → .github/agents/
  const charters = await loadAllCharters(p.chartersDir);
  await mirrorCharters(charters, p.githubAgentsDir);
  console.log(chalk.gray(`  mirrored ${charters.length} charter(s) to .github/agents/`));

  // 4. Guided interview (Architect) → project.md
  if (!opts.nonInteractive) {
    console.log(chalk.cyan(`▸ Running Architect guided interview…`));
    await runInterview(root);
  } else {
    console.log(chalk.gray(`  skipped guided interview (--non-interactive)`));
  }

  console.log(chalk.green(`✓ Initialized. Next: eas plan "<your goal>"`));
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
      // Don't overwrite existing files (idempotent re-init)
      try {
        await fs.stat(d);
      } catch {
        await fs.copyFile(s, d);
      }
    }
  }
}
