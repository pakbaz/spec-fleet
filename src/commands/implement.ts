/**
 * `eas implement` — Execute the latest plan. For each task we delegate the
 * brief to the specified subagent in an isolated session.
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import chalk from "chalk";
import fg from "fast-glob";
import yaml from "yaml";
import { EasRuntime } from "../runtime/index.js";

interface ImplementOptions {
  task?: string;
  all?: boolean;
  gates?: boolean;
}

interface PlanTask {
  id: string;
  agent: string;
  subagent?: string;
  title: string;
  brief: string;
  depends_on?: string[];
}

export async function implementCommand(opts: ImplementOptions): Promise<void> {
  const rt = await EasRuntime.open();
  try {
    const tasks = await loadLatestPlan(rt.paths.plansDir);
    if (tasks.length === 0) {
      console.log(chalk.yellow("No tasks found. Run `eas plan \"<goal>\"` first."));
      return;
    }

    const filtered = opts.task ? tasks.filter((t) => t.id === opts.task) : tasks;
    if (filtered.length === 0) throw new Error(`Task not found: ${opts.task}`);

    const done = new Set<string>();
    for (const task of filtered) {
      if (task.depends_on?.some((d) => !done.has(d))) {
        console.log(chalk.gray(`  skipping ${task.id} — unmet deps`));
        continue;
      }
      const charterName = task.subagent ?? task.agent;
      console.log(chalk.cyan(`▸ ${task.id} → ${charterName}`));
      const result = await rt.delegate(rt.rootCharter().name, charterName, briefFor(task));
      console.log(chalk.gray(result.output.split("\n").slice(0, 6).join("\n")));
      if (result.redactedSecrets > 0) {
        console.log(chalk.yellow(`  ⚠ ${result.redactedSecrets} secret(s) redacted from output`));
      }
      done.add(task.id);
      await rt.appendDecision({
        id: `task-${task.id}`,
        timestamp: new Date().toISOString(),
        agent: charterName,
        kind: "result",
        title: task.title,
        body: result.output.slice(0, 4000),
        refs: [],
      });

      if (!opts.all && !opts.task) break; // single-task mode by default
    }
    console.log(chalk.green(`✓ Done`));
  } finally {
    await rt.dispose();
  }
}

function briefFor(t: PlanTask): string {
  return `${t.title}\n\n${t.brief}`;
}

async function loadLatestPlan(plansDir: string): Promise<PlanTask[]> {
  const files = await fg("*.md", { cwd: plansDir, absolute: true });
  if (files.length === 0) return [];
  files.sort();
  const latest = files[files.length - 1]!;
  const raw = await fs.readFile(latest, "utf8");
  return parseTasks(raw);
}

/**
 * Parse the loose markdown plan format produced by the orchestrator. We accept
 * either the YAML-style list documented in plan.ts or a tolerant fallback.
 */
function parseTasks(md: string): PlanTask[] {
  const tasks: PlanTask[] = [];
  const block = md.match(/## Tasks([\s\S]*?)(?:\n## |$)/);
  if (!block) return tasks;
  const body = block[1] ?? "";
  const items = body.split(/\n(?=- id: )/).filter((s) => s.trim().startsWith("- id:"));
  for (const item of items) {
    try {
      const cleaned = item.replace(/^- /, "").trim();
      const obj = yaml.parse(cleaned) as PlanTask;
      if (obj && typeof obj.id === "string" && typeof obj.brief === "string") tasks.push(obj);
    } catch {
      // skip malformed entry
    }
  }
  return tasks;
}
