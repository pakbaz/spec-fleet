/**
 * `eas tune` — Read scoreboard + audit + decisions, aggregate failures per
 * charter, and write a unified-diff suggestion to `.eas/tune/<ts>.diff`.
 * Advisory only — never auto-applied.
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import chalk from "chalk";
import { EasRuntime } from "../runtime/index.js";
import { ensureDir, writeFileAtomic, readMaybe } from "../util/paths.js";

export interface TuneOptions {
  since?: string;
}

interface ScoreRow {
  ts: string;
  id: string;
  charter: string;
  pass: boolean;
  failures: string[];
  duration_ms: number;
}

interface CharterStats {
  charter: string;
  total: number;
  fails: number;
  forbidden: Set<string>;
  toolBudgetHits: number;
}

export async function tuneCommand(opts: TuneOptions = {}): Promise<string | null> {
  const rt = await EasRuntime.open();
  try {
    const scoreboardPath = path.join(rt.paths.easDir, "eval", "scoreboard.jsonl");
    const raw = (await readMaybe(scoreboardPath)) ?? "";
    const rows: ScoreRow[] = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line) as ScoreRow;
        if (opts.since && r.ts < opts.since) continue;
        rows.push(r);
      } catch {
        // skip malformed
      }
    }

    if (rows.length === 0) {
      console.log(chalk.yellow("(scoreboard empty — run `eas eval` first)"));
      return null;
    }

    const statsByCharter = new Map<string, CharterStats>();
    for (const r of rows) {
      let s = statsByCharter.get(r.charter);
      if (!s) {
        s = { charter: r.charter, total: 0, fails: 0, forbidden: new Set(), toolBudgetHits: 0 };
        statsByCharter.set(r.charter, s);
      }
      s.total++;
      if (!r.pass) {
        s.fails++;
        for (const f of r.failures) {
          const fb = f.match(/^forbidden:"(.+)"$/);
          if (fb && fb[1]) s.forbidden.add(fb[1]);
          if (/^tool_calls=/.test(f)) s.toolBudgetHits++;
        }
      }
    }

    const worst = [...statsByCharter.values()]
      .filter((s) => s.fails > 0)
      .sort((a, b) => b.fails / b.total - a.fails / a.total)
      .slice(0, 3);

    if (worst.length === 0) {
      console.log(chalk.green("✓ no failing charters in window"));
      return null;
    }

    const diff = await buildDiff(worst, rt.paths.chartersDir);
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const tuneDir = path.join(rt.paths.easDir, "tune");
    await ensureDir(tuneDir);
    const outPath = path.join(tuneDir, `${ts}.diff`);
    await writeFileAtomic(outPath, diff);
    console.log(chalk.green(`✓ Suggestions written to ${path.relative(process.cwd(), outPath)}`));
    console.log(chalk.gray("  (advisory — review and apply manually)"));
    return outPath;
  } finally {
    await rt.dispose();
  }
}

async function buildDiff(worst: CharterStats[], chartersDir: string): Promise<string> {
  const chunks: string[] = [
    `# eas tune — advisory charter edits`,
    `# generated: ${new Date().toISOString()}`,
    `# review carefully; never apply blindly.`,
    ``,
  ];
  for (const s of worst) {
    const charterFile = await locateCharter(chartersDir, s.charter);
    const rel = charterFile ? path.relative(process.cwd(), charterFile) : `${s.charter}.charter.md`;
    const lines: string[] = [];
    if (s.forbidden.size > 0) {
      for (const word of s.forbidden) {
        lines.push(`+- Must avoid: ${word}`);
      }
    }
    if (s.toolBudgetHits > 0) {
      lines.push(`+- Be tool-call efficient: prefer one batched read over N small reads.`);
    }
    if (lines.length === 0) {
      lines.push(`+- (no heuristic suggestion; review failures manually)`);
    }
    chunks.push(
      `--- a/${rel}`,
      `+++ b/${rel}`,
      `@@ charter:${s.charter} fails=${s.fails}/${s.total} @@`,
      ` ## Constraints`,
      ...lines,
      ``,
    );
  }
  return chunks.join("\n");
}

async function locateCharter(chartersDir: string, name: string): Promise<string | null> {
  for (const candidate of [
    path.join(chartersDir, `${name}.charter.md`),
    path.join(chartersDir, "subagents", `${name}.charter.md`),
  ]) {
    try {
      await fs.stat(candidate);
      return candidate;
    } catch {
      // try next
    }
  }
  return null;
}
