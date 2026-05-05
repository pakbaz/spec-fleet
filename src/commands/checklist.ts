/**
 * `specfleet checklist <spec-id>` — Phase 8 (post-implement drift detection).
 *
 * Per the SpecKit community guidance: after implementation, walk every spec
 * requirement and tick whether it is actually realized in the code. The
 * compliance charter produces `checklist.md` with each item + status +
 * pointer to the file/test that proves it.
 */
import chalk from "chalk";
import { Workspace } from "../runtime/workspace.js";
import { runPhase, defaultCharterForPhase, type SharedPhaseCommandOptions } from "./_phase.js";

export interface ChecklistOptions extends SharedPhaseCommandOptions {}

export async function checklistCommand(specId: string, opts: ChecklistOptions = {}): Promise<void> {
  if (!specId) throw new Error("spec id required");
  const ws = await Workspace.open();
  const charter = opts.charter ?? defaultCharterForPhase("checklist");
  await runPhase({
    ws,
    phase: "checklist",
    specId,
    charter,
    model: opts.model,
    allowTool: opts.allowTool,
    nonInteractive: opts.nonInteractive,
    dryRun: opts.dryRun,
  });
  console.log(chalk.green(`✓ Checklist generated for ${specId}`));
}
