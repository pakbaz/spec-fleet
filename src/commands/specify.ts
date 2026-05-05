/**
 * `specfleet specify <name> [--description …]` — Phase 1.
 *
 * Creates a new spec directory and asks the orchestrator to draft `spec.md`
 * (Spec-Kit shape: Goal · Background · Requirements · Out of scope · Risks).
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import chalk from "chalk";
import matter from "gray-matter";
import { Workspace } from "../runtime/workspace.js";
import { ensureDir } from "../util/paths.js";
import { runPhase, slugifySpecId, defaultCharterForPhase, type SharedPhaseCommandOptions } from "./_phase.js";

export interface SpecifyOptions extends SharedPhaseCommandOptions {
  description?: string;
}

export async function specifyCommand(name: string, opts: SpecifyOptions = {}): Promise<void> {
  if (!name || !name.trim()) throw new Error("spec name required (e.g. specfleet specify payment-flow)");
  const ws = await Workspace.open();
  const specId = slugifySpecId(name);
  if (!specId) throw new Error(`Invalid spec name: ${name}`);

  const dir = path.join(ws.paths.specsDir, specId);
  await ensureDir(dir);

  // Seed an empty spec.md with frontmatter so future phases can advance status.
  const specFile = path.join(dir, "spec.md");
  try {
    await fs.access(specFile);
  } catch {
    const seed = matter.stringify(`# ${name}\n\n_(spec body — will be filled by Phase 1)_\n`, {
      id: specId,
      title: name,
      status: "draft",
      created: new Date().toISOString().slice(0, 10),
    });
    await fs.writeFile(specFile, seed, "utf8");
  }

  const charter = opts.charter ?? defaultCharterForPhase("specify");
  await runPhase({
    ws,
    phase: "specify",
    specId,
    charter,
    userInput: opts.description ?? "",
    model: opts.model,
    allowTool: opts.allowTool,
    nonInteractive: opts.nonInteractive,
    dryRun: opts.dryRun,
  });
  console.log(chalk.green(`✓ Specified ${specId}`));
}
