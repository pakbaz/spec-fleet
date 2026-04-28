import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { handleMcpRequest } from "../../src/commands/mcp-serve.js";

let tmp: string;
const cwd = process.cwd();

interface TestPaths {
  specFleetDir: string;
  decisions: string;
  project: string;
  instruction: string;
  chartersDir: string;
  auditDir: string;
}

async function setup(): Promise<TestPaths> {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "specfleet-mcp-"));
  const specFleetDir = path.join(tmp, ".specfleet");
  const chartersDir = path.join(specFleetDir, "charters");
  const auditDir = path.join(specFleetDir, "audit");
  await fs.mkdir(chartersDir, { recursive: true });
  await fs.mkdir(auditDir, { recursive: true });
  await fs.writeFile(path.join(specFleetDir, "instruction.md"), "# instruction\n", "utf8");
  await fs.writeFile(path.join(specFleetDir, "project.md"), "# project\nname: demo\n", "utf8");
  await fs.writeFile(
    path.join(specFleetDir, "decisions.md"),
    "## 2024-01-01 · dev · plan · alpha\n\nbody about authentication.\n\n## 2024-01-02 · dev · plan · beta\n\nunrelated paragraph.\n",
    "utf8",
  );
  await fs.writeFile(
    path.join(chartersDir, "dev.charter.md"),
    "---\nname: dev\ndescription: Dev charter\n---\n\nbody",
    "utf8",
  );
  return {
    specFleetDir,
    decisions: path.join(specFleetDir, "decisions.md"),
    project: path.join(specFleetDir, "project.md"),
    instruction: path.join(specFleetDir, "instruction.md"),
    chartersDir,
    auditDir,
  };
}

beforeEach(() => {});

afterEach(async () => {
  process.chdir(cwd);
  if (tmp) await fs.rm(tmp, { recursive: true, force: true });
});

describe("specfleet mcp serve — JSON-RPC handler", () => {
  it("answers initialize", async () => {
    const p = await setup();
    const resp = await handleMcpRequest({ jsonrpc: "2.0", id: 1, method: "initialize" }, p);
    expect(resp).not.toBeNull();
    expect((resp!.result as { protocolVersion: string }).protocolVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("answers tools/list with all 5 tools", async () => {
    const p = await setup();
    const resp = await handleMcpRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" }, p);
    const tools = (resp!.result as { tools: { name: string }[] }).tools;
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "list_charters",
      "query_audit",
      "query_charter",
      "query_decisions",
      "query_project",
    ]);
  });

  it("query_decisions returns matching paragraphs only", async () => {
    const p = await setup();
    const resp = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "query_decisions", arguments: { q: "authentication" } },
      },
      p,
    );
    const text = (resp!.result as { content: { text: string }[] }).content[0]!.text;
    expect(text).toContain("authentication");
    expect(text).not.toContain("unrelated paragraph");
  });

  it("query_charter returns the file body", async () => {
    const p = await setup();
    const resp = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "query_charter", arguments: { role: "dev" } },
      },
      p,
    );
    const text = (resp!.result as { content: { text: string }[] }).content[0]!.text;
    expect(text).toContain("name: dev");
  });

  it("list_charters enumerates", async () => {
    const p = await setup();
    const resp = await handleMcpRequest(
      { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "list_charters" } },
      p,
    );
    const text = (resp!.result as { content: { text: string }[] }).content[0]!.text;
    const arr = JSON.parse(text) as { role: string }[];
    expect(arr.find((x) => x.role === "dev")).toBeTruthy();
  });

  it("resources/list and resources/read work", async () => {
    const p = await setup();
    const list = await handleMcpRequest({ jsonrpc: "2.0", id: 6, method: "resources/list" }, p);
    const uris = (list!.result as { resources: { uri: string }[] }).resources.map((r) => r.uri);
    expect(uris).toContain("specfleet://instruction");

    const read = await handleMcpRequest(
      { jsonrpc: "2.0", id: 7, method: "resources/read", params: { uri: "specfleet://project" } },
      p,
    );
    const text = (read!.result as { contents: { text: string }[] }).contents[0]!.text;
    expect(text).toContain("name: demo");
  });

  it("returns JSON-RPC error for unknown method", async () => {
    const p = await setup();
    const resp = await handleMcpRequest({ jsonrpc: "2.0", id: 8, method: "nonsense" }, p);
    expect(resp!.error).toBeDefined();
    expect(resp!.error!.message).toMatch(/Unknown method/);
  });

  it("ignores notifications (no id)", async () => {
    const p = await setup();
    const resp = await handleMcpRequest({ jsonrpc: "2.0", method: "tools/list" }, p);
    expect(resp).toBeNull();
  });
});
