/**
 * `eas plan <goal>` — Ask the orchestrator to decompose a goal into role-agent
 * tasks. Writes a markdown plan to .eas/plans/<timestamp>.md.
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import chalk from "chalk";
import ora from "ora";
import { EasRuntime } from "../runtime/index.js";

interface PlanOptions {
  out?: string;
}

export async function planCommand(goal: string, opts: PlanOptions): Promise<void> {
  if (!goal.trim()) throw new Error("goal is required");
  const rt = await EasRuntime.open();
  const spinner = ora(`Planning: ${chalk.bold(goal)}`).start();
  try {
    const orchestrator = await rt.spawn(rt.rootCharter().name);
    const project = await rt.readProject();
    const projectCtx = project
      ? `<project>\n${JSON.stringify(project, null, 2)}\n</project>`
      : "<project>(not initialized — run eas init)</project>";

    const prompt = [
      projectCtx,
      ``,
      `<goal>${goal}</goal>`,
      ``,
      `Produce a structured plan in this exact markdown format (no extra prose):`,
      ``,
      `# Plan: <restated goal>`,
      ``,
      `## Tasks`,
      `- id: <kebab-case-id>`,
      `  agent: <one of: dev, test, devsecops, architect, compliance, sre>`,
      `  subagent: <e.g. dev/backend>  # optional`,
      `  title: <imperative title>`,
      `  brief: <2-3 sentence brief — enough for an isolated subagent to execute>`,
      `  depends_on: [<ids>]            # optional`,
      ``,
      `Aim for 4-10 tasks. Order them so a topological execution makes sense.`,
    ].join("\n");

    const out = await orchestrator.ask(prompt);
    await orchestrator.dispose();

    const outPath =
      opts.out ?? path.join(rt.paths.plansDir, `${new Date().toISOString().replace(/[:.]/g, "-")}.md`);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, `# Goal\n\n${goal}\n\n${out}\n`, "utf8");

    spinner.succeed(`Plan written to ${chalk.cyan(path.relative(process.cwd(), outPath))}`);
    await rt.appendDecision({
      id: `plan-${Date.now()}`,
      timestamp: new Date().toISOString(),
      agent: rt.rootCharter().name,
      kind: "plan",
      title: `Plan for: ${goal.slice(0, 80)}`,
      body: `Plan written to ${outPath}`,
      refs: [outPath],
    });
  } catch (err) {
    spinner.fail();
    throw err;
  } finally {
    await rt.dispose();
  }
}
