/**
 * Shared Scratchpad — file-backed working memory for a spec.
 *
 * Pattern: each spec gets one markdown scratchpad at
 * `.specfleet/scratchpad/<spec-id>.md` with four canonical sections
 * (Findings · Decisions · Open Questions · Files Touched). Charters can
 * read/append/search via the `mcp serve` JSON-RPC tools, or just
 * read the file directly when running outside MCP. When work
 * completes, the orchestrator archives it under `scratchpad/archive/`.
 *
 * The format is documented in `.specfleet/skills/scratchpad-format.md`
 * and intentionally human-readable so reviewers can audit it.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { ensureDir } from "../util/paths.js";

export const SCRATCHPAD_SECTIONS = [
  "Findings",
  "Decisions",
  "Open Questions",
  "Files Touched",
] as const;

export type ScratchpadSection = (typeof SCRATCHPAD_SECTIONS)[number];

export interface ScratchpadAppendEntry {
  section: ScratchpadSection;
  author: string; // charter name or "human"
  content: string;
}

export interface ScratchpadSearchHit {
  section: ScratchpadSection;
  line: number;
  excerpt: string;
}

export function isScratchpadSection(s: string): s is ScratchpadSection {
  return (SCRATCHPAD_SECTIONS as readonly string[]).includes(s);
}

function emptyScratchpad(specId: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [`# Scratchpad · ${specId}`, `<!-- created: ${today} -->`, ""];
  for (const s of SCRATCHPAD_SECTIONS) {
    lines.push(`## ${s}`, "");
  }
  return lines.join("\n");
}

export async function readScratchpad(file: string, specId: string): Promise<string> {
  try {
    return await fs.readFile(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    await ensureDir(path.dirname(file));
    const seed = emptyScratchpad(specId);
    await fs.writeFile(file, seed, "utf8");
    return seed;
  }
}

export async function appendScratchpad(
  file: string,
  specId: string,
  entry: ScratchpadAppendEntry,
): Promise<void> {
  if (!isScratchpadSection(entry.section)) {
    throw new Error(
      `Unknown scratchpad section: ${entry.section}. Use one of: ${SCRATCHPAD_SECTIONS.join(", ")}`,
    );
  }
  const current = await readScratchpad(file, specId);
  const ts = new Date().toISOString();
  const block = `\n- _[${ts}] **${entry.author}**_ — ${entry.content.trim()}\n`;
  const updated = insertUnderHeading(current, entry.section, block);
  await fs.writeFile(file, updated, "utf8");
}

function insertUnderHeading(content: string, heading: string, block: string): string {
  // Find `## <heading>` and append `block` directly under it (before the next `## ` or EOF).
  const re = new RegExp(`(^## ${heading}\\s*\\n)([\\s\\S]*?)(?=^## |\\Z)`, "m");
  if (!re.test(content)) {
    // Heading missing — append a new one at end of file.
    const tail = content.endsWith("\n") ? content : content + "\n";
    return `${tail}\n## ${heading}\n${block}`;
  }
  return content.replace(re, (_, head: string, body: string) => `${head}${body.replace(/\s+$/, "")}${block}`);
}

export function searchScratchpad(content: string, query: string): ScratchpadSearchHit[] {
  if (!query) return [];
  const needle = query.toLowerCase();
  const hits: ScratchpadSearchHit[] = [];
  const lines = content.split("\n");
  let section: ScratchpadSection | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const h = line.match(/^## (.+?)\s*$/);
    if (h && h[1] && isScratchpadSection(h[1])) {
      section = h[1];
      continue;
    }
    if (section && line.toLowerCase().includes(needle)) {
      hits.push({ section, line: i + 1, excerpt: line.trim().slice(0, 240) });
    }
  }
  return hits;
}

export async function archiveScratchpad(
  scratchpadFile: string,
  archiveDir: string,
): Promise<{ archivedTo: string }> {
  await ensureDir(archiveDir);
  const base = path.basename(scratchpadFile);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(archiveDir, `${stamp}__${base}`);
  await fs.rename(scratchpadFile, target);
  return { archivedTo: target };
}
