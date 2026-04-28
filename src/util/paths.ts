import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * Locate the .specfleet/ root walking up from cwd. Throws if not found.
 */
export async function findSpecFleetRoot(start: string = process.cwd()): Promise<string> {
  let dir = path.resolve(start);
  while (true) {
    const candidate = path.join(dir, ".specfleet");
    const legacy = path.join(dir, ".eas");
    try {
      const st = await fs.stat(candidate);
      if (st.isDirectory()) return dir;
    } catch {
      // not here
    }
    try {
      const st = await fs.stat(legacy);
      if (st.isDirectory()) {
        throw new Error("Legacy .eas/ directory found. Run `specfleet init --mode upgrade` to migrate to .specfleet/.");
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Legacy .eas/")) throw err;
    }
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error("No .specfleet/ directory found (run `specfleet init` first)");
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
  const tmp = path.join(os.tmpdir(), `specfleet-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.writeFile(tmp, content, "utf8");
  await fs.rename(tmp, p);
}

export function specFleetPaths(root: string) {
  const specFleetDir = path.join(root, ".specfleet");
  return {
    root,
    specFleetDir,
    instruction: path.join(specFleetDir, "instruction.md"),
    project: path.join(specFleetDir, "project.md"),
    decisions: path.join(specFleetDir, "decisions.md"),
    chartersDir: path.join(specFleetDir, "charters"),
    skillsDir: path.join(specFleetDir, "skills"),
    policiesDir: path.join(specFleetDir, "policies"),
    mcpDir: path.join(specFleetDir, "mcp"),
    indexDir: path.join(specFleetDir, "index"),
    checkpointsDir: path.join(specFleetDir, "checkpoints"),
    auditDir: path.join(specFleetDir, "audit"),
    plansDir: path.join(specFleetDir, "plans"),
    githubAgentsDir: path.join(root, ".github", "agents"),
  };
}
