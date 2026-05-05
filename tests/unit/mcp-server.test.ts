import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { initCommand } from "../../src/commands/init.js";
import { handleMcpRequest } from "../../src/commands/mcp-serve.js";
import { specFleetPaths } from "../../src/util/paths.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "specfleet-mcp-"));
  await initCommand({ dir: tmp, nonInteractive: true });
  await fs.mkdir(path.join(tmp, ".specfleet", "scratchpad"), { recursive: true });
  await fs.mkdir(path.join(tmp, ".specfleet", "scratchpad", "archive"), {
    recursive: true,
  });
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("MCP server (stdio JSON-RPC)", () => {
  it("initialize advertises tool + resource capabilities", async () => {
    const p = specFleetPaths(tmp);
    const resp = await handleMcpRequest(
      { jsonrpc: "2.0", id: 1, method: "initialize" },
      p,
    );
    expect(resp).not.toBeNull();
    const result = (resp as { result: { capabilities: Record<string, unknown> } }).result;
    expect(result.capabilities).toHaveProperty("tools");
    expect(result.capabilities).toHaveProperty("resources");
  });

  it("tools/list returns the seven SpecFleet tools", async () => {
    const p = specFleetPaths(tmp);
    const resp = await handleMcpRequest(
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      p,
    );
    const result = (resp as { result: { tools: Array<{ name: string }> } }).result;
    const names = result.tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "query_charter",
        "query_constitution",
        "query_project",
        "scratchpad_append",
        "scratchpad_archive",
        "scratchpad_read",
        "scratchpad_search",
      ].sort(),
    );
  });

  it("scratchpad_append + scratchpad_read round-trip", async () => {
    const p = specFleetPaths(tmp);
    await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "scratchpad_append",
          arguments: {
            spec_id: "demo",
            section: "Findings",
            author: "test",
            content: "round trip",
          },
        },
      },
      p,
    );
    const read = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "scratchpad_read", arguments: { spec_id: "demo" } },
      },
      p,
    );
    const text = (read as { result: { content: Array<{ text: string }> } }).result
      .content[0]!.text;
    expect(text).toContain("round trip");
  });

  it("query_charter returns the charter markdown", async () => {
    const p = specFleetPaths(tmp);
    const resp = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: "query_charter", arguments: { name: "dev" } },
      },
      p,
    );
    const text = (resp as { result: { content: Array<{ text: string }> } }).result
      .content[0]!.text;
    expect(text).toMatch(/name:\s*dev/);
  });
});
