/**
 * Path resolution for `.specfleet/` and the `.github/` artefacts SpecFleet generates.
 *
 * v0.6 reorganized layout:
 *   .specfleet/
 *     instruction.md           constitution
 *     project.md               project cheat sheet
 *     config.json              model selection + workspace defaults
 *     charters/                7 task-contract charters
 *     mcp/                     scoped MCP server manifests
 *     skills/                  on-demand markdown procedures
 *     policies/secrets.json    pre-commit secret scanner config
 *     specs/<id>/              spec.md + clarifications.md + plan.md + tasks.md
 *                              + analysis.md + review.md + checklist.md
 *     scratchpad/<id>.md       short-lived shared state for a spec
 *     scratchpad/archive/      retired scratchpads
 *     runs/<run-id>.jsonl      per-invocation transcript
 *   .github/
 *     copilot-instructions.md  repo-wide Copilot guidance
 *     agents/                  flat mirror of charters (primary runtime contract)
 *     prompts/                 8 phase prompts (specfleet.<phase>.prompt.md)
 *     instructions/            path-scoped *.instructions.md
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

export async function findSpecFleetRoot(start: string = process.cwd()): Promise<string> {
  let dir = path.resolve(start);
  while (true) {
    try {
      const st = await fs.stat(path.join(dir, ".specfleet"));
      if (st.isDirectory()) return dir;
    } catch {
      // not here
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error("No .specfleet/ directory found (run `specfleet init` first)");
    }
    dir = parent;
  }
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function readMaybe(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
}

export async function writeFileAtomic(p: string, content: string): Promise<void> {
  await ensureDir(path.dirname(p));
  const tmp = path.join(
    os.tmpdir(),
    `specfleet-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await fs.writeFile(tmp, content, "utf8");
  await fs.rename(tmp, p);
}

export function specFleetPaths(root: string) {
  const specFleetDir = path.join(root, ".specfleet");
  const githubDir = path.join(root, ".github");
  return {
    root,
    specFleetDir,
    instruction: path.join(specFleetDir, "instruction.md"),
    project: path.join(specFleetDir, "project.md"),
    config: path.join(specFleetDir, "config.json"),
    chartersDir: path.join(specFleetDir, "charters"),
    skillsDir: path.join(specFleetDir, "skills"),
    policiesDir: path.join(specFleetDir, "policies"),
    mcpDir: path.join(specFleetDir, "mcp"),
    specsDir: path.join(specFleetDir, "specs"),
    scratchpadDir: path.join(specFleetDir, "scratchpad"),
    scratchpadArchive: path.join(specFleetDir, "scratchpad", "archive"),
    runsDir: path.join(specFleetDir, "runs"),
    githubDir,
    copilotInstructions: path.join(githubDir, "copilot-instructions.md"),
    githubAgentsDir: path.join(githubDir, "agents"),
    githubPromptsDir: path.join(githubDir, "prompts"),
    githubInstructionsDir: path.join(githubDir, "instructions"),
  };
}

export type SpecFleetPaths = ReturnType<typeof specFleetPaths>;

export function specPaths(workspaceRoot: string, specId: string) {
  const dir = path.join(workspaceRoot, ".specfleet", "specs", specId);
  return {
    dir,
    spec: path.join(dir, "spec.md"),
    clarifications: path.join(dir, "clarifications.md"),
    plan: path.join(dir, "plan.md"),
    tasks: path.join(dir, "tasks.md"),
    analysis: path.join(dir, "analysis.md"),
    review: path.join(dir, "review.md"),
    checklist: path.join(dir, "checklist.md"),
    scratchpad: path.join(workspaceRoot, ".specfleet", "scratchpad", `${specId}.md`),
  };
}

export type SpecPaths = ReturnType<typeof specPaths>;
