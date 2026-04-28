/**
 * `specfleet status` — Summarize charters, recent audit events, and any pending
 * gates from the decisions log.
 */
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import chalk from "chalk";
import { SpecFleetRuntime } from "../runtime/index.js";

export async function statusCommand(): Promise<void> {
  const rt = await SpecFleetRuntime.open();
  try {
    console.log(chalk.bold(`SpecFleet @ ${rt.root}`));
    const project = await rt.readProject();
    if (project) {
      console.log(`  project: ${chalk.cyan(project.name)} (${project.mode}, ${project.primaryLanguage}/${project.runtime})`);
    } else {
      console.log(chalk.yellow(`  no project.md (run specfleet init)`));
    }

    const charters = rt.listCharters();
    console.log(`\n${chalk.bold("Charters")} (${charters.length})`);
    const byTier: Record<string, string[]> = { root: [], role: [], subagent: [], subsubagent: [] };
    for (const c of charters) byTier[c.tier]?.push(c.name);
    for (const t of ["root", "role", "subagent", "subsubagent"] as const) {
      if (byTier[t]?.length) console.log(`  ${t.padEnd(11)} ${byTier[t]?.join(", ")}`);
    }

    // Plans
    const plans = await fs.readdir(rt.paths.plansDir).catch(() => [] as string[]);
    console.log(`\n${chalk.bold("Plans")} (${plans.length})`);
    for (const p of plans.slice(-5)) console.log(`  ${p}`);

    // Recent audit
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const events = await rt.audit.readAll({ since });
    console.log(`\n${chalk.bold("Audit")} (last 24h: ${events.length} events)`);
    for (const e of events.slice(-10)) {
      console.log(`  ${e.ts}  ${e.agent.padEnd(20)}  ${e.kind}`);
    }

    // Pending gates from decisions
    const decisions = await fs.readFile(rt.paths.decisions, "utf8").catch(() => "");
    const gates = decisions.match(/^## .* · gate · .*$/gm) ?? [];
    if (gates.length) {
      console.log(`\n${chalk.bold("Gates")}`);
      for (const g of gates.slice(-5)) console.log(`  ${g}`);
    }

    // Local Copilot session workspaces. Use os.homedir() rather than $HOME
    // directly so that minimal containers (where HOME may be unset) still
    // resolve to a real path on Windows (USERPROFILE) or Linux/Mac.
    const home = os.homedir();
    if (home) {
      const sessionRoot = path.join(home, ".copilot", "session-state");
      const sessions = await fs.readdir(sessionRoot).catch(() => [] as string[]);
      console.log(`\n${chalk.bold("Local Copilot sessions")} (${sessions.length})`);
    }
  } finally {
    await rt.dispose();
  }
}
