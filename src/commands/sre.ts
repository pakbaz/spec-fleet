/**
 * `specfleet sre triage` — Dispatches the `sre` charter to triage recent failures.
 * Inputs: an optional SARIF file (defaults to globbing **\/*.sarif) and the
 * last 50 audit events with kind=error/policy.block. Output: a triage report
 * written to .specfleet/triage/<ISO>.md.
 *
 * Set SPECFLEET_SRE_MOCK=1 to skip live SDK delegation (tests / offline).
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import chalk from "chalk";
import fg from "fast-glob";
import { SpecFleetRuntime } from "../runtime/index.js";
import { ensureDir, writeFileAtomic, readMaybe } from "../util/paths.js";

export interface SreOptions {
  sarif?: string;
}

export async function sreCommand(action: "triage", opts: SreOptions): Promise<void> {
  if (action !== "triage") throw new Error(`Unknown sre action: ${action}`);

  const rt = await SpecFleetRuntime.open();
  try {
    const sarifContent = await collectSarif(rt.root, opts.sarif);
    const events = await rt.audit.readAll();
    const failures = events
      .filter((e) => e.kind === "error" || e.kind === "policy.block" || e.kind === "budget.block")
      .slice(-50);

    const brief = [
      `# SRE triage brief`,
      ``,
      `## Recent failures (audit, last ${failures.length})`,
      "```json",
      JSON.stringify(failures, null, 2),
      "```",
      ``,
      `## SARIF findings`,
      sarifContent ? "```json\n" + sarifContent.slice(0, 8000) + "\n```" : "(no SARIF input)",
      ``,
      `Apply the triage skill: classify each failure, propose root-cause hypotheses, and recommend next steps.`,
    ].join("\n");

    let report: string;
    if (process.env.SPECFLEET_SRE_MOCK === "1") {
      report = `# Triage (mock)\n\n${failures.length} failure(s) reviewed. SARIF: ${
        sarifContent ? "present" : "absent"
      }.\n`;
    } else {
      const result = await rt.delegate(rt.rootCharter().name, "sre", brief);
      report = result.output;
    }

    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const triageDir = path.join(rt.paths.specFleetDir, "triage");
    await ensureDir(triageDir);
    const outPath = path.join(triageDir, `${ts}.md`);
    await writeFileAtomic(outPath, `# SRE Triage ${ts}\n\n${report}\n`);
    console.log(chalk.green(`✓ Triage written to ${path.relative(process.cwd(), outPath)}`));

    await rt.appendDecision({
      id: `triage-${Date.now()}`,
      timestamp: new Date().toISOString(),
      agent: "sre",
      kind: "result",
      title: `SRE triage`,
      body: `Reviewed ${failures.length} failure(s). Report: ${outPath}`,
      refs: [outPath],
    });
  } finally {
    await rt.dispose();
  }
}

async function collectSarif(root: string, override?: string): Promise<string | null> {
  if (override) return readMaybe(path.resolve(override));
  const matches = await fg("**/*.sarif", { cwd: root, absolute: true, ignore: ["**/node_modules/**"] });
  if (matches.length === 0) return null;
  const buf: string[] = [];
  for (const f of matches.slice(0, 5)) {
    const c = await fs.readFile(f, "utf8");
    buf.push(`// ${path.relative(root, f)}\n${c}`);
  }
  return buf.join("\n\n");
}
