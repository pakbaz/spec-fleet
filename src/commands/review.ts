/**
 * `specfleet review <spec-id>` — Phase 7. Cross-model review.
 *
 * The implementation phase ran with `models.default` (e.g. Claude Sonnet);
 * review runs with `models.review` (e.g. GPT-5.1) so we don't ask the same
 * model to grade its own work. See ADR-0005.
 */
import chalk from "chalk";
import { Workspace } from "../runtime/workspace.js";
import { runPhase, defaultCharterForPhase, type SharedPhaseCommandOptions } from "./_phase.js";

export interface ReviewOptions extends SharedPhaseCommandOptions {
  /** Force same-model review (skip cross-model). */
  sameModel?: boolean;
}

export async function reviewCommand(specId: string, opts: ReviewOptions = {}): Promise<void> {
  if (!specId) throw new Error("spec id required");
  const ws = await Workspace.open();
  const charter = opts.charter ?? defaultCharterForPhase("review");
  await runPhase({
    ws,
    phase: "review",
    specId,
    charter,
    useReviewModel: !opts.sameModel,
    model: opts.model,
    allowTool: opts.allowTool,
    nonInteractive: opts.nonInteractive,
    dryRun: opts.dryRun,
  });
  console.log(chalk.green(`✓ Reviewed ${specId}`));
}
