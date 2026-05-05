/**
 * `specfleet tasks <spec-id>` — Phase 4. Decomposes the plan into a
 * topologically ordered task list with role assignments. Output is
 * checked into `tasks.md` (Spec-Kit shape).
 */
import chalk from "chalk";
import { Workspace } from "../runtime/workspace.js";
import { runPhase, defaultCharterForPhase, type SharedPhaseCommandOptions } from "./_phase.js";

export interface TasksOptions extends SharedPhaseCommandOptions {}

export async function tasksCommand(specId: string, opts: TasksOptions = {}): Promise<void> {
  if (!specId) throw new Error("spec id required");
  const ws = await Workspace.open();
  const charter = opts.charter ?? defaultCharterForPhase("tasks");
  await runPhase({
    ws,
    phase: "tasks",
    specId,
    charter,
    model: opts.model,
    allowTool: opts.allowTool,
    nonInteractive: opts.nonInteractive,
    dryRun: opts.dryRun,
  });
  console.log(chalk.green(`✓ Tasked ${specId}`));
}
