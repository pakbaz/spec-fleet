import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * Locate the .eas/ root walking up from cwd. Throws if not found.
 */
export async function findEasRoot(start: string = process.cwd()): Promise<string> {
  let dir = path.resolve(start);
  while (true) {
    const candidate = path.join(dir, ".eas");
    try {
      const st = await fs.stat(candidate);
      if (st.isDirectory()) return dir;
    } catch {
      // not here
    }
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error("No .eas/ directory found (run `eas init` first)");
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
  const tmp = path.join(os.tmpdir(), `eas-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.writeFile(tmp, content, "utf8");
  await fs.rename(tmp, p);
}

export function easPaths(root: string) {
  const easDir = path.join(root, ".eas");
  return {
    root,
    easDir,
    instruction: path.join(easDir, "instruction.md"),
    project: path.join(easDir, "project.md"),
    decisions: path.join(easDir, "decisions.md"),
    chartersDir: path.join(easDir, "charters"),
    skillsDir: path.join(easDir, "skills"),
    policiesDir: path.join(easDir, "policies"),
    mcpDir: path.join(easDir, "mcp"),
    indexDir: path.join(easDir, "index"),
    checkpointsDir: path.join(easDir, "checkpoints"),
    auditDir: path.join(easDir, "audit"),
    plansDir: path.join(easDir, "plans"),
    githubAgentsDir: path.join(root, ".github", "agents"),
  };
}
