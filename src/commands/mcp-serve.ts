/**
 * `specfleet mcp serve` — Stdio JSON-RPC 2.0 MCP server that exposes SpecFleet context
 * (decisions, charters, project, audit) as MCP tools and resources so a
 * Copilot CLI / VS Code instance can query org context without re-reading
 * files. Pure Node, no extra deps.
 *
 * Contract:
 *   stdin:  newline-delimited JSON-RPC 2.0 requests
 *   stdout: newline-delimited JSON-RPC 2.0 responses
 *
 * Methods implemented: initialize, tools/list, tools/call, resources/list,
 * resources/read. Notifications (no `id`) are accepted and ignored.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import fg from "fast-glob";
import matter from "gray-matter";
import { findSpecFleetRoot, specFleetPaths, readMaybe } from "../util/paths.js";
import { AuditLog } from "../runtime/audit.js";

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
const SERVER_INFO = { name: "specfleet-mcp", version: "0.2.0" } as const;

const TOOLS = [
  {
    name: "query_decisions",
    description: "Search .specfleet/decisions.md for paragraphs matching a substring (case-insensitive).",
    inputSchema: {
      type: "object",
      properties: { q: { type: "string", description: "Substring to search for" } },
      required: ["q"],
    },
  },
  {
    name: "query_charter",
    description: "Return the YAML frontmatter and body of a charter by role/name (e.g. 'dev' or 'dev/backend').",
    inputSchema: {
      type: "object",
      properties: { role: { type: "string", description: "Charter name (slash-separated for subagents)" } },
      required: ["role"],
    },
  },
  {
    name: "query_project",
    description: "Return the contents of .specfleet/project.md.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "query_audit",
    description: "Return the last N audit events, optionally scoped to a sessionId.",
    inputSchema: {
      type: "object",
      properties: {
        session: { type: "string", description: "Optional sessionId prefix filter" },
        limit: { type: "number", description: "Max events (default 50)" },
      },
    },
  },
  {
    name: "list_charters",
    description: "List every charter in .specfleet/charters as { role, path, summary }.",
    inputSchema: { type: "object", properties: {} },
  },
] as const;

interface PathsLike {
  specFleetDir: string;
  decisions: string;
  project: string;
  instruction: string;
  chartersDir: string;
  auditDir: string;
}

/**
 * Pure JSON-RPC handler. Exported for unit testing.
 * Returns a response, or null for notifications.
 */
export async function handleMcpRequest(
  req: JsonRpcRequest,
  paths: PathsLike,
): Promise<JsonRpcResponse | null> {
  if (req.id === undefined || req.id === null) {
    // Notification — no response.
    return null;
  }
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
          { uri: "specfleet://instruction", name: "instruction.md", mimeType: "text/markdown" },
          { uri: "specfleet://decisions", name: "decisions.md", mimeType: "text/markdown" },
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
    case "specfleet://instruction":
      return p.instruction;
    case "specfleet://decisions":
      return p.decisions;
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
    case "query_decisions": {
      const q = String(args.q ?? "").toLowerCase();
      if (!q) throw new Error("q required");
      const raw = (await readMaybe(p.decisions)) ?? "";
      const paras = raw.split(/\n\s*\n/).filter((para) => para.toLowerCase().includes(q));
      return paras.length ? paras.join("\n\n---\n\n") : "(no matches)";
    }
    case "query_charter": {
      const role = String(args.role ?? "");
      if (!role) throw new Error("role required");
      const flat = path.join(p.chartersDir, `${role}.charter.md`);
      const nested = path.join(p.chartersDir, "subagents", `${role}.charter.md`);
      const raw = (await readMaybe(flat)) ?? (await readMaybe(nested));
      if (!raw) throw new Error(`charter not found: ${role}`);
      return raw;
    }
    case "query_project":
      return (await readMaybe(p.project)) ?? "(project.md not initialized)";
    case "query_audit": {
      const session = args.session ? String(args.session) : undefined;
      const limit = typeof args.limit === "number" ? args.limit : 50;
      const log = new AuditLog(p.auditDir);
      await log.init();
      const events = await log.readAll(session ? { sessionId: session } : undefined);
      const tail = events.slice(-limit);
      return JSON.stringify(tail, null, 2);
    }
    case "list_charters": {
      const files = await fg("**/*.charter.md", { cwd: p.chartersDir, absolute: true });
      const out: { role: string; path: string; summary: string }[] = [];
      for (const f of files) {
        const raw = await fs.readFile(f, "utf8");
        const fm = matter(raw);
        const data = fm.data as { name?: string; description?: string };
        out.push({
          role: data.name ?? path.basename(f, ".charter.md"),
          path: path.relative(p.specFleetDir, f),
          summary: (data.description ?? "").slice(0, 200),
        });
      }
      return JSON.stringify(out, null, 2);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export async function mcpServeCommand(opts: McpServeOptions = {}): Promise<void> {
  const root = await findSpecFleetRoot(opts.dir ?? process.cwd());
  const p = specFleetPaths(root);

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

  // Hold the event loop open until stdin closes.
  await new Promise<void>((resolve) => rl.on("close", () => resolve()));
}
