/**
 * `specfleet implement <spec-id>` — Phase 6. The dev charter executes tasks.md
 * end-to-end, writing code/tests, with the test charter looped in for
 * verification. We delegate the iteration loop to the agent itself
 * (Copilot CLI's task tool spawns subagents internally) and capture a
 * concise summary in the spec scratchpad.
 */
import chalk from "chalk";
import { Workspace } from "../runtime/workspace.js";
import { runPhase, defaultCharterForPhase, type SharedPhaseCommandOptions } from "./_phase.js";

export interface ImplementOptions extends SharedPhaseCommandOptions {
  task?: string;
}

export async function implementCommand(specId: string, opts: ImplementOptions = {}): Promise<void> {
  if (!specId) throw new Error("spec id required");
  const ws = await Workspace.open();
  const charter = opts.charter ?? defaultCharterForPhase("implement");
  const userInput = opts.task ? `Focus on task id: ${opts.task}` : "";
  await runPhase({
    ws,
    phase: "implement",
    specId,
    charter,
    userInput,
    model: opts.model,
    allowTool: opts.allowTool,
    nonInteractive: opts.nonInteractive,
    dryRun: opts.dryRun,
  });
  console.log(chalk.green(`✓ Implementation pass complete for ${specId}`));
}
