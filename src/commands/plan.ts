/**
 * `specfleet plan <spec-id>` — Phase 3. Produces an architecture plan
 * informed by spec.md + clarifications.md. The architect charter handles
 * stack decisions, contracts, integration points.
 */
import chalk from "chalk";
import { Workspace } from "../runtime/workspace.js";
import { runPhase, type SharedPhaseCommandOptions } from "./_phase.js";

export interface PlanOptions extends SharedPhaseCommandOptions {}

export async function planCommand(specId: string, opts: PlanOptions = {}): Promise<void> {
  if (!specId) throw new Error("spec id required");
  const ws = await Workspace.open();
  // Architect drives plan; orchestrator can override via --charter.
  const charter = opts.charter ?? "architect";
  await runPhase({
    ws,
    phase: "plan",
    specId,
    charter,
    model: opts.model,
    allowTool: opts.allowTool,
    nonInteractive: opts.nonInteractive,
    dryRun: opts.dryRun,
  });
  console.log(chalk.green(`✓ Planned ${specId}`));
}
