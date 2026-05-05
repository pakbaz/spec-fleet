/**
 * Charter loader — parses YAML frontmatter + markdown body into a validated
 * Charter, then mirrors it into `.github/agents/<name>.agent.md` so devs
 * running `copilot` directly inherit the same task contract.
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
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid charter ${file}:\n${issues}`);
  }
  return parsed.data;
}

export async function loadAllCharters(chartersDir: string): Promise<Charter[]> {
  const files = await fg("*.charter.md", { cwd: chartersDir, absolute: true });
  const charters = await Promise.all(files.map(loadCharter));
  // v0.6 dropped the tier graph: each charter is independent, the
  // orchestrator delegates to whichever one fits the task. The only
  // invariant is uniqueness.
  const seen = new Set<string>();
  for (const c of charters) {
    if (seen.has(c.name)) throw new Error(`Duplicate charter name: ${c.name}`);
    seen.add(c.name);
  }
  return charters;
}

/**
 * Render a charter as a Copilot CLI `.agent.md`. The frontmatter is
 * intentionally minimal — Copilot CLI only needs `name`, `description`,
 * `tools`, and (optionally) `model`.
 */
export function toCopilotAgentMd(c: Charter): string {
  const fm: Record<string, unknown> = {
    name: c.name,
    description: c.description,
  };
  if (c.allowedTools.length > 0) fm.tools = c.allowedTools;
  if (c.model) fm.model = c.model;
  const yaml = Object.entries(fm)
    .map(([k, v]) =>
      Array.isArray(v) ? `${k}:\n${v.map((x) => `  - ${x}`).join("\n")}` : `${k}: ${v}`,
    )
    .join("\n");
  return `---\n${yaml}\n---\n\n${c.body}\n`;
}

export async function mirrorCharters(charters: Charter[], githubAgentsDir: string): Promise<void> {
  await fs.mkdir(githubAgentsDir, { recursive: true });
  // Clean stale mirrors so renamed/removed charters don't linger.
  const existing = await fs.readdir(githubAgentsDir).catch(() => [] as string[]);
  const wanted = new Set(charters.map((c) => `${c.name}.agent.md`));
  for (const f of existing) {
    if (f.endsWith(".agent.md") && !wanted.has(f)) {
      await fs.unlink(path.join(githubAgentsDir, f)).catch(() => {});
    }
  }
  for (const c of charters) {
    await fs.writeFile(path.join(githubAgentsDir, `${c.name}.agent.md`), toCopilotAgentMd(c), "utf8");
  }
}
