/**
 * `specfleet clarify <spec-id>` — Phase 2. The orchestrator surfaces ambiguous
 * requirements as questions; the user (or any caller) can supply answers via
 * `--answer "Q: ... / A: ..."` flags or by hand-editing clarifications.md.
 */
import chalk from "chalk";
import { Workspace } from "../runtime/workspace.js";
import { runPhase, defaultCharterForPhase, type SharedPhaseCommandOptions } from "./_phase.js";

export interface ClarifyOptions extends SharedPhaseCommandOptions {
  answers?: string[];
}

export async function clarifyCommand(specId: string, opts: ClarifyOptions = {}): Promise<void> {
  if (!specId) throw new Error("spec id required");
  const ws = await Workspace.open();
  const charter = opts.charter ?? defaultCharterForPhase("clarify");
  const userInput =
    opts.answers && opts.answers.length > 0
      ? `Existing clarifications:\n${opts.answers.map((a) => `- ${a}`).join("\n")}`
      : "";
  await runPhase({
    ws,
    phase: "clarify",
    specId,
    charter,
    userInput,
    model: opts.model,
    allowTool: opts.allowTool,
    nonInteractive: opts.nonInteractive,
    dryRun: opts.dryRun,
  });
  console.log(chalk.green(`✓ Clarified ${specId}`));
}
