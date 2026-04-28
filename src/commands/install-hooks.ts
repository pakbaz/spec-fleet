/**
 * `specfleet init --hooks-only` — install a git pre-commit hook that runs the SpecFleet
 * staged-diff scanner (secret detection + IP-guard) before allowing a commit.
 *
 * The hook shells out to `node <path>/dist/commands/precommit-scan.js`
 * (resolved at install time relative to this file) so it works whether SpecFleet
 * is installed globally, locally, or run from source via tsx.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";

interface InstallHooksOptions {
  dir?: string;
  force?: boolean;
}

export async function installHooksCommand(opts: InstallHooksOptions = {}): Promise<void> {
  const repoRoot = path.resolve(opts.dir ?? process.cwd());
  const gitDir = path.join(repoRoot, ".git");
  try {
    const st = await fs.stat(gitDir);
    if (!st.isDirectory()) throw new Error(".git is not a directory");
  } catch {
    console.error(chalk.red(`✖ ${repoRoot} is not a git repository (no .git/)`));
    process.exitCode = 1;
    return;
  }

  const hooksDir = path.join(gitDir, "hooks");
  await fs.mkdir(hooksDir, { recursive: true });
  const hookPath = path.join(hooksDir, "pre-commit");

  // Resolve the scanner entry: dist/commands/install-hooks.js → dist/commands/precommit-scan.js
  const __filename = fileURLToPath(import.meta.url);
  const scannerJs = path.join(path.dirname(__filename), "precommit-scan.js");

  const script = [
    "#!/bin/sh",
    "# Installed by `specfleet init` (or `specfleet init --hooks-only`) — runs the SpecFleet staged-diff scanner.",
    "# Skip with: git commit --no-verify   (NOT recommended)",
    `SPECFLEET_SCANNER=${JSON.stringify(scannerJs)}`,
    'if command -v specfleet >/dev/null 2>&1; then',
    '  exec specfleet check --staged "$@"',
    'elif [ -f "$SPECFLEET_SCANNER" ]; then',
    '  exec node "$SPECFLEET_SCANNER" "$@"',
    'else',
    '  echo "specfleet pre-commit hook: scanner not found; skipping (reinstall with: specfleet init --no-hooks=false)" >&2',
    '  exit 0',
    'fi',
    "",
  ].join("\n");

  if (!opts.force) {
    try {
      await fs.access(hookPath);
      const existing = await fs.readFile(hookPath, "utf8");
      if (!existing.includes("SPECFLEET_SCANNER")) {
        console.error(
          chalk.red(`✖ ${hookPath} already exists (not installed by SpecFleet). Use --force to overwrite.`),
        );
        process.exitCode = 1;
        return;
      }
    } catch {
      // hook does not exist — proceed
    }
  }

  await fs.writeFile(hookPath, script, "utf8");
  await fs.chmod(hookPath, 0o755);
  console.log(chalk.green(`✓ installed pre-commit hook at ${hookPath}`));
}
