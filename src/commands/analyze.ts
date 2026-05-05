/**
 * `specfleet analyze <spec-id>` — Phase 5. Pre-implementation static analysis:
 * the architect charter inspects the plan + tasks for risks (perf, security,
 * data, ops) and writes mitigations to `analysis.md`.
 */
import chalk from "chalk";
import { Workspace } from "../runtime/workspace.js";
import { runPhase, defaultCharterForPhase, type SharedPhaseCommandOptions } from "./_phase.js";

export interface AnalyzeOptions extends SharedPhaseCommandOptions {}

export async function analyzeCommand(specId: string, opts: AnalyzeOptions = {}): Promise<void> {
  if (!specId) throw new Error("spec id required");
  const ws = await Workspace.open();
  const charter = opts.charter ?? defaultCharterForPhase("analyze");
  await runPhase({
    ws,
    phase: "analyze",
    specId,
    charter,
    model: opts.model,
    allowTool: opts.allowTool,
    nonInteractive: opts.nonInteractive,
    dryRun: opts.dryRun,
  });
  console.log(chalk.green(`✓ Analyzed ${specId}`));
}
