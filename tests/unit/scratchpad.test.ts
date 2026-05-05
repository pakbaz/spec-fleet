import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  appendScratchpad,
  archiveScratchpad,
  readScratchpad,
  searchScratchpad,
  isScratchpadSection,
  SCRATCHPAD_SECTIONS,
} from "../../src/runtime/scratchpad.js";

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "specfleet-scratchpad-"));
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("scratchpad", () => {
  it("seeds an empty file with the four canonical sections", async () => {
    const file = path.join(dir, "demo.md");
    const raw = await readScratchpad(file, "demo");
    for (const s of SCRATCHPAD_SECTIONS) {
      expect(raw).toContain(`## ${s}`);
    }
  });

  it("appends notes under the requested section with author prefix", async () => {
    const file = path.join(dir, "demo.md");
    await appendScratchpad(file, "demo", {
      section: "Findings",
      author: "architect",
      content: "Auth header parsed twice",
    });
    const raw = await fs.readFile(file, "utf8");
    const findingsBlock = raw.split("## Findings")[1]!.split("##")[0]!;
    expect(findingsBlock).toMatch(/\*\*architect\*\*_ — Auth header parsed twice/);
  });

  it("searchScratchpad reports section + line for hits", async () => {
    const file = path.join(dir, "demo.md");
    await appendScratchpad(file, "demo", {
      section: "Decisions",
      author: "dev",
      content: "use pino",
    });
    const content = await readScratchpad(file, "demo");
    const hits = searchScratchpad(content, "pino");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.section).toBe("Decisions");
    expect(hits[0]!.line).toBeGreaterThan(0);
  });

  it("archiveScratchpad moves the file under archive/ with a timestamp suffix", async () => {
    const file = path.join(dir, "demo.md");
    await appendScratchpad(file, "demo", {
      section: "Findings",
      author: "dev",
      content: "x",
    });
    const archive = path.join(dir, "archive");
    const result = await archiveScratchpad(file, archive);
    expect(result.archivedTo).toContain(archive);
    const before = await fs
      .access(file)
      .then(() => true)
      .catch(() => false);
    expect(before).toBe(false);
    const list = await fs.readdir(archive);
    expect(list.length).toBe(1);
    expect(list[0]).toMatch(/__demo\.md$/);
  });

  it("isScratchpadSection guards the union", () => {
    expect(isScratchpadSection("Findings")).toBe(true);
    expect(isScratchpadSection("Other")).toBe(false);
  });
});
