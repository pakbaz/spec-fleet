/**
 * `specfleet mcp serve` — Stdio JSON-RPC 2.0 MCP server.
 *
 * v0.6 surface (lean by design):
 *
 *   tools/
 *     query_charter      ↦ raw charter markdown
 *     query_project      ↦ project.md
 *     query_constitution ↦ instruction.md
 *     scratchpad_read    ↦ markdown of .specfleet/scratchpad/<spec_id>.md
 *     scratchpad_append  ↦ append to a section
 *     scratchpad_search  ↦ substring hits with section/line
 *     scratchpad_archive ↦ rotate to scratchpad/archive/
 *
 *   resources/
 *     specfleet://constitution
 *     specfleet://project
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { findSpecFleetRoot, specFleetPaths, readMaybe } from "../util/paths.js";
import {
  appendScratchpad,
  archiveScratchpad,
  readScratchpad,
  searchScratchpad,
  isScratchpadSection,
  SCRATCHPAD_SECTIONS,
} from "../runtime/scratchpad.js";

export interface McpServeOptions {
  dir?: string;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "specfleet-mcp", version: "0.6.0" } as const;

const TOOLS = [
  {
    name: "query_charter",
    description: "Return the raw markdown of a charter by name (e.g. 'dev').",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string", description: "Charter name (kebab-case)" } },
      required: ["name"],
    },
  },
  {
    name: "query_project",
    description: "Return .specfleet/project.md.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "query_constitution",
    description: "Return .specfleet/instruction.md (the project constitution).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "scratchpad_read",
    description: "Read the shared scratchpad for a spec (creates an empty one if missing).",
    inputSchema: {
      type: "object",
      properties: { spec_id: { type: "string", description: "Spec id (kebab-case)" } },
      required: ["spec_id"],
    },
  },
  {
    name: "scratchpad_append",
    description: `Append a note to a scratchpad section. Section ∈ ${SCRATCHPAD_SECTIONS.join(" | ")}.`,
    inputSchema: {
      type: "object",
      properties: {
        spec_id: { type: "string" },
        section: { type: "string", enum: [...SCRATCHPAD_SECTIONS] },
        author: { type: "string", description: "Charter name or 'human'" },
        content: { type: "string" },
      },
      required: ["spec_id", "section", "author", "content"],
    },
  },
  {
    name: "scratchpad_search",
    description: "Substring search across the scratchpad; returns hits with section + line number.",
    inputSchema: {
      type: "object",
      properties: { spec_id: { type: "string" }, query: { type: "string" } },
      required: ["spec_id", "query"],
    },
  },
  {
    name: "scratchpad_archive",
    description: "Move the scratchpad to `.specfleet/scratchpad/archive/` (call when work is done).",
    inputSchema: {
      type: "object",
      properties: { spec_id: { type: "string" } },
      required: ["spec_id"],
    },
  },
] as const;

interface PathsLike {
  specFleetDir: string;
  instruction: string;
  project: string;
  chartersDir: string;
  scratchpadDir: string;
  scratchpadArchive: string;
}

export async function handleMcpRequest(
  req: JsonRpcRequest,
  paths: PathsLike,
): Promise<JsonRpcResponse | null> {
  if (req.id === undefined || req.id === null) return null;
  const id = req.id;
  try {
    const result = await dispatch(req.method, req.params ?? {}, paths);
    return { jsonrpc: "2.0", id, result };
  } catch (err) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: (err as Error).message },
    };
  }
}

async function dispatch(
  method: string,
  params: Record<string, unknown>,
  p: PathsLike,
): Promise<unknown> {
  switch (method) {
    case "initialize":
      return {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {}, resources: {} },
        serverInfo: SERVER_INFO,
      };
    case "tools/list":
      return { tools: TOOLS };
    case "tools/call": {
      const name = String(params.name ?? "");
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      const text = await callTool(name, args, p);
      return { content: [{ type: "text", text }] };
    }
    case "resources/list":
      return {
        resources: [
          { uri: "specfleet://constitution", name: "instruction.md", mimeType: "text/markdown" },
          { uri: "specfleet://project", name: "project.md", mimeType: "text/markdown" },
        ],
      };
    case "resources/read": {
      const uri = String(params.uri ?? "");
      const file = resolveResourceUri(uri, p);
      const text = (await readMaybe(file)) ?? "";
      return { contents: [{ uri, mimeType: "text/markdown", text }] };
    }
    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

function resolveResourceUri(uri: string, p: PathsLike): string {
  switch (uri) {
    case "specfleet://constitution":
      return p.instruction;
    case "specfleet://project":
      return p.project;
    default:
      throw new Error(`Unknown resource uri: ${uri}`);
  }
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  p: PathsLike,
): Promise<string> {
  switch (name) {
    case "query_charter": {
      const n = String(args.name ?? "");
      if (!n) throw new Error("name required");
      const file = path.join(p.chartersDir, `${n}.charter.md`);
      const raw = await readMaybe(file);
      if (!raw) throw new Error(`charter not found: ${n}`);
      return raw;
    }
    case "query_project":
      return (await readMaybe(p.project)) ?? "(project.md not initialized)";
    case "query_constitution":
      return (await readMaybe(p.instruction)) ?? "(instruction.md not initialized)";
    case "scratchpad_read": {
      const specId = String(args.spec_id ?? "");
      if (!specId) throw new Error("spec_id required");
      const file = path.join(p.scratchpadDir, `${specId}.md`);
      return await readScratchpad(file, specId);
    }
    case "scratchpad_append": {
      const specId = String(args.spec_id ?? "");
      const section = String(args.section ?? "");
      const author = String(args.author ?? "");
      const content = String(args.content ?? "");
      if (!specId || !section || !author || !content) {
        throw new Error("spec_id, section, author, content all required");
      }
      if (!isScratchpadSection(section)) {
        throw new Error(`section must be one of: ${SCRATCHPAD_SECTIONS.join(", ")}`);
      }
      const file = path.join(p.scratchpadDir, `${specId}.md`);
      await appendScratchpad(file, specId, { section, author, content });
      return "ok";
    }
    case "scratchpad_search": {
      const specId = String(args.spec_id ?? "");
      const query = String(args.query ?? "");
      if (!specId || !query) throw new Error("spec_id and query required");
      const file = path.join(p.scratchpadDir, `${specId}.md`);
      const content = await readScratchpad(file, specId);
      const hits = searchScratchpad(content, query);
      return JSON.stringify(hits, null, 2);
    }
    case "scratchpad_archive": {
      const specId = String(args.spec_id ?? "");
      if (!specId) throw new Error("spec_id required");
      const file = path.join(p.scratchpadDir, `${specId}.md`);
      const result = await archiveScratchpad(file, p.scratchpadArchive);
      return JSON.stringify(result, null, 2);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export async function mcpServeCommand(opts: McpServeOptions = {}): Promise<void> {
  const root = await findSpecFleetRoot(opts.dir ?? process.cwd());
  const p = specFleetPaths(root);
  await fs.mkdir(p.scratchpadDir, { recursive: true });
  await fs.mkdir(p.scratchpadArchive, { recursive: true });

  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let req: JsonRpcRequest;
    try {
      req = JSON.parse(trimmed) as JsonRpcRequest;
    } catch {
      return;
    }
    const resp = await handleMcpRequest(req, p);
    if (resp) process.stdout.write(JSON.stringify(resp) + "\n");
  });
  await new Promise<void>((resolve) => rl.on("close", () => resolve()));
}
