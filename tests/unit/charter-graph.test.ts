import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadAllCharters } from "../../src/runtime/charter.js";

async function tmpdir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "specfleet-charter-"));
}

async function writeCharter(dir: string, rel: string, frontmatter: Record<string, unknown>, body: string) {
  const file = path.join(dir, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const yaml = Object.entries(frontmatter)
    .map(([k, v]) => (Array.isArray(v) ? `${k}:\n${v.map((x) => `  - ${x}`).join("\n")}` : `${k}: ${JSON.stringify(v)}`))
    .join("\n");
  await fs.writeFile(file, `---\n${yaml}\n---\n\n${body}\n`, "utf8");
}

describe("loadAllCharters / validateGraph", () => {
  it("loads a valid orchestrator+role graph", async () => {
    const dir = await tmpdir();
    await writeCharter(dir, "orchestrator.charter.md", {
      name: "orchestrator", displayName: "Orch", role: "orchestrator", tier: "root",
      description: "root", spawns: ["dev"],
    }, "Orchestrator body sufficient length here.");
    await writeCharter(dir, "dev.charter.md", {
      name: "dev", displayName: "Dev", role: "dev", tier: "role", parent: "orchestrator",
      description: "dev",
    }, "Dev body sufficient length here.");
    const charters = await loadAllCharters(dir);
    expect(charters.map((c) => c.name).sort()).toEqual(["dev", "orchestrator"]);
  });

  it("rejects a graph with no root", async () => {
    const dir = await tmpdir();
    await writeCharter(dir, "dev.charter.md", {
      name: "dev", displayName: "Dev", role: "dev", tier: "role",
      description: "dev",
    }, "Dev body sufficient length here.");
    await expect(loadAllCharters(dir)).rejects.toThrow(/No "root" charter/);
  });

  it("rejects a graph with multiple roots", async () => {
    const dir = await tmpdir();
    for (const n of ["a", "b"]) {
      await writeCharter(dir, `${n}.charter.md`, {
        name: n, displayName: n, role: "orchestrator", tier: "root", description: "x",
      }, "Body sufficient length here.");
    }
    await expect(loadAllCharters(dir)).rejects.toThrow(/Multiple root charters/);
  });

  it("rejects a missing parent reference", async () => {
    const dir = await tmpdir();
    await writeCharter(dir, "orchestrator.charter.md", {
      name: "orchestrator", displayName: "O", role: "orchestrator", tier: "root", description: "x",
    }, "Body sufficient length here.");
    await writeCharter(dir, "orphan.charter.md", {
      name: "orphan", displayName: "O", role: "dev", tier: "subagent", parent: "ghost", description: "x",
    }, "Body sufficient length here.");
    await expect(loadAllCharters(dir)).rejects.toThrow(/missing parent "ghost"/);
  });

  it("rejects a missing spawn child", async () => {
    const dir = await tmpdir();
    await writeCharter(dir, "orchestrator.charter.md", {
      name: "orchestrator", displayName: "O", role: "orchestrator", tier: "root",
      description: "x", spawns: ["ghost"],
    }, "Body sufficient length here.");
    await expect(loadAllCharters(dir)).rejects.toThrow(/missing child "ghost"/);
  });
});
