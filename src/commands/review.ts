/**
 * `specfleet review` — Run Compliance + Architect agents over the current diff.
 * For MVP we collect `git diff --staged` (falling back to working tree) and
 * delegate it to each role agent in an isolated session.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import chalk from "chalk";
import { SpecFleetRuntime } from "../runtime/index.js";

const exec = promisify(execFile);

export async function reviewCommand(): Promise<void> {
  const rt = await SpecFleetRuntime.open();
  try {
    const diff = await collectDiff(rt.root);
    if (!diff.trim()) {
      console.log(chalk.yellow("No changes to review."));
      return;
    }
    const charters = rt.listCharters();
    const targets = ["compliance", "architect"]
      .map((role) => charters.find((c) => c.role === role && c.tier === "role"))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));

    if (targets.length === 0) {
      console.log(chalk.yellow("No compliance/architect charters found."));
      return;
    }

    for (const c of targets) {
      console.log(chalk.cyan(`▸ ${c.name}`));
      const res = await rt.delegate(rt.rootCharter().name, c.name, [
        `Review the following diff against your charter and the corporate instruction.md.`,
        `Return findings as a markdown table: | severity | rule | file | message |.`,
        ``,
        "```diff",
        diff.slice(0, 200_000), // cap to keep within budget
        "```",
      ].join("\n"));
      console.log(res.output);
      if (res.redactedSecrets > 0) {
        console.log(chalk.yellow(`  ⚠ ${res.redactedSecrets} secret(s) redacted`));
      }
    }
  } finally {
    await rt.dispose();
  }
}

async function collectDiff(root: string): Promise<string> {
  try {
    const { stdout } = await exec("git", ["diff", "--staged"], { cwd: root, maxBuffer: 50 * 1024 * 1024 });
    if (stdout.trim()) return stdout;
    const { stdout: wt } = await exec("git", ["diff"], { cwd: root, maxBuffer: 50 * 1024 * 1024 });
    return wt;
  } catch {
    return "";
  }
}
