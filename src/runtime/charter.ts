/**
 * Charter loader — parses YAML frontmatter + markdown body into a validated Charter.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import fg from "fast-glob";
import { CharterSchema, type Charter } from "../schema/index.js";

export async function loadCharter(file: string): Promise<Charter> {
  const raw = await fs.readFile(file, "utf8");
  const fm = matter(raw);
  const candidate = { ...(fm.data as Record<string, unknown>), body: fm.content.trim() };
  const parsed = CharterSchema.safeParse(candidate);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid charter ${file}:\n${issues}`);
  }
  return parsed.data;
}

export async function loadAllCharters(chartersDir: string): Promise<Charter[]> {
  const files = await fg("**/*.charter.md", { cwd: chartersDir, absolute: true });
  const charters = await Promise.all(files.map(loadCharter));
  validateGraph(charters);
  return charters;
}

function validateGraph(charters: Charter[]): void {
  const byName = new Map(charters.map((c) => [c.name, c]));
  for (const c of charters) {
    if (c.parent && !byName.has(c.parent)) {
      throw new Error(`Charter "${c.name}" references missing parent "${c.parent}"`);
    }
    for (const child of c.spawns) {
      if (!byName.has(child)) {
        throw new Error(`Charter "${c.name}" spawns missing child "${child}"`);
      }
    }
  }
  // Exactly one root (the orchestrator).
  const roots = charters.filter((c) => c.tier === "root");
  if (roots.length === 0) throw new Error('No "root" charter found (need an orchestrator)');
  if (roots.length > 1) {
    throw new Error(`Multiple root charters: ${roots.map((r) => r.name).join(", ")}`);
  }
}

/**
 * Render a charter as a Copilot CLI .agent.md (graceful degradation: devs running
 * `copilot` directly inherit the same prompt body and tool allowlist).
 */
export function toCopilotAgentMd(c: Charter): string {
  const fm: Record<string, unknown> = {
    name: c.name,
    description: c.description,
  };
  if (c.allowedTools.length > 0) fm.tools = c.allowedTools;
  if (c.model) fm.model = c.model;
  const yaml = Object.entries(fm)
    .map(([k, v]) => (Array.isArray(v) ? `${k}:\n${v.map((x) => `  - ${x}`).join("\n")}` : `${k}: ${v}`))
    .join("\n");
  return `---\n${yaml}\n---\n\n${c.body}\n`;
}

export async function mirrorCharters(charters: Charter[], githubAgentsDir: string): Promise<void> {
  await fs.mkdir(githubAgentsDir, { recursive: true });
  for (const c of charters) {
    // Copilot CLI agent files are flat (no subdirs) — flatten with `-`.
    const flat = c.name.replace(/\//g, "-") + ".agent.md";
    await fs.writeFile(path.join(githubAgentsDir, flat), toCopilotAgentMd(c), "utf8");
  }
}
