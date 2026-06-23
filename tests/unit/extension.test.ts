import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Repo root (this file lives in tests/unit/).
const ROOT = join(__dirname, "..", "..");
const manifestPath = join(ROOT, "extension.yml");
const manifest = readFileSync(manifestPath, "utf8");

const ID_RE = /^[a-z0-9-]+$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const COMMAND_NAME_RE = /^speckit\.specfleet\.[a-z0-9-]+$/;

const VALID_HOOK_EVENTS = new Set([
  "before_specify", "after_specify",
  "before_plan", "after_plan",
  "before_tasks", "after_tasks",
  "before_implement", "after_implement",
  "before_analyze", "after_analyze",
  "before_checklist", "after_checklist",
  "before_clarify", "after_clarify",
  "before_constitution", "after_constitution",
  "before_taskstoissues", "after_taskstoissues",
]);

function scalar(key: string): string | undefined {
  const m = manifest.match(new RegExp(`^\\s*${key}:\\s*"?([^"\\n]+)"?\\s*$`, "m"));
  return m?.[1]?.trim();
}

// Parse `name:`/`file:` pairs from the provides.commands block.
function commandEntries(): { name: string; file: string }[] {
  const entries: { name: string; file: string }[] = [];
  const re = /-\s*name:\s*"([^"]+)"\s*\n\s*file:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(manifest))) entries.push({ name: m[1], file: m[2] });
  return entries;
}

describe("SpecFleet Spec-Kit extension manifest", () => {
  it("declares schema_version 1.0", () => {
    expect(scalar("schema_version")).toBe("1.0");
  });

  it("uses a valid, non-overlapping extension id", () => {
    const id = scalar("id");
    expect(id).toBeTruthy();
    expect(ID_RE.test(id!)).toBe(true);
    // Must not collide with the existing community `fleet` (Fleet Orchestrator) extension.
    expect(id).not.toBe("fleet");
    expect(id).toBe("specfleet");
  });

  it("has a semantic version", () => {
    expect(SEMVER_RE.test(scalar("version")!)).toBe(true);
  });

  it("requires a minimum spec-kit version", () => {
    expect(manifest).toMatch(/speckit_version:\s*">=?\d/);
  });

  it("declares at least one command", () => {
    expect(commandEntries().length).toBeGreaterThan(0);
  });

  it("names every command speckit.specfleet.<cmd> and ships its file with frontmatter", () => {
    for (const cmd of commandEntries()) {
      expect(COMMAND_NAME_RE.test(cmd.name), `bad command name: ${cmd.name}`).toBe(true);
      const filePath = join(ROOT, cmd.file);
      expect(existsSync(filePath), `missing command file: ${cmd.file}`).toBe(true);
      const body = readFileSync(filePath, "utf8");
      expect(body.startsWith("---"), `${cmd.file} missing YAML frontmatter`).toBe(true);
      expect(body).toMatch(/description:/);
      expect(body, `${cmd.file} should consume $ARGUMENTS`).toContain("$ARGUMENTS");
    }
  });

  it("only references valid hook events", () => {
    const hooksIdx = manifest.indexOf("\nhooks:");
    expect(hooksIdx).toBeGreaterThan(-1);
    // Bound the block to the next top-level key (defaults:/tags:/etc.).
    const rest = manifest.slice(hooksIdx + "\nhooks:".length);
    const nextTop = rest.search(/^\S/m);
    const block = nextTop === -1 ? rest : rest.slice(0, nextTop);
    const events = [...block.matchAll(/^\s{2}([a-z_]+):/gm)].map((m) => m[1]);
    expect(events.length).toBeGreaterThan(0);
    for (const ev of events) {
      expect(VALID_HOOK_EVENTS.has(ev), `invalid hook event: ${ev}`).toBe(true);
    }
  });

  it("ships the config template referenced by the manifest", () => {
    expect(manifest).toMatch(/template:\s*"specfleet-config\.template\.yml"/);
    expect(existsSync(join(ROOT, "specfleet-config.template.yml"))).toBe(true);
  });

  it("ships a LICENSE and an .extensionignore", () => {
    expect(existsSync(join(ROOT, "LICENSE"))).toBe(true);
    expect(existsSync(join(ROOT, ".extensionignore"))).toBe(true);
  });
});
