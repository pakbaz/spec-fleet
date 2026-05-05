/**
 * `dispatch` — fork `copilot -p - [--allow-tool …] [--no-interactive]` and
 * stream stdout/stderr back to a caller. v0.6 SpecFleet is a thin shim:
 * every phase eventually goes through this single function, so it is the
 * only place that knows about the Copilot CLI binary's argv shape.
 *
 * The model selection/concurrency/depth env vars are documented in
 * docs/cli.md. We never invent flags — only the ones Copilot CLI actually
 * accepts ship through here.
 */
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ensureDir } from "../util/paths.js";

export interface DispatchOptions {
  /** The prompt to send. Required unless `args` provides one. */
  prompt: string;
  /** Charter / agent name (mirrored into Copilot via `--agent`). */
  agent?: string;
  /** Model override (`--model`). */
  model?: string;
  /** Restrict the toolset; passed as one or more `--allow-tool` flags. */
  allowTool?: string[];
  /** Disable confirmation prompts (always set in non-TTY contexts). */
  nonInteractive?: boolean;
  /** Working directory for the spawned process. */
  cwd: string;
  /** Per-spec scratchpad / spec id, recorded in the run transcript. */
  specId?: string;
  /** Phase tag used for budget logging. */
  phase?:
    | "specify"
    | "clarify"
    | "plan"
    | "tasks"
    | "analyze"
    | "implement"
    | "review"
    | "checklist"
    | "freeform";
  /** Where `<run-id>.jsonl` should be written (typically `.specfleet/runs`). */
  runsDir: string;
  /** Override the binary (test hook). Default `copilot`. */
  binary?: string;
  /** Override env (test hook). */
  env?: NodeJS.ProcessEnv;
  /** Stream stdout/stderr to the parent process? (default true). */
  inherit?: boolean;
  /** Hard timeout in ms (default: none). */
  timeoutMs?: number;
}

export interface DispatchResult {
  runId: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  /** The argv we actually invoked (sans `binary`) — useful for logs/tests. */
  argv: string[];
  /** Path to the JSONL transcript on disk. */
  transcript: string;
}

/**
 * Verify the Copilot CLI binary is present and authenticated. Returns the
 * resolved version string, or `null` if the binary is missing.
 */
export function probeCopilot(binary?: string): { ok: boolean; version: string | null; error?: string } {
  const bin = binary ?? process.env.SPECFLEET_COPILOT_BINARY ?? "copilot";
  try {
    const r = spawnSync(bin, ["--version"], { encoding: "utf8" });
    if (r.error) return { ok: false, version: null, error: r.error.message };
    if (r.status !== 0) {
      return { ok: false, version: null, error: (r.stderr ?? "").trim() || `exit ${r.status}` };
    }
    return { ok: true, version: r.stdout.trim() };
  } catch (err) {
    return { ok: false, version: null, error: (err as Error).message };
  }
}

export async function dispatch(opts: DispatchOptions): Promise<DispatchResult> {
  if (!opts.prompt || opts.prompt.length === 0) throw new Error("dispatch: prompt is required");
  if (!opts.runsDir) throw new Error("dispatch: runsDir is required");
  if (!opts.cwd) throw new Error("dispatch: cwd is required");

  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const argv = buildArgv(opts);
  const binary = opts.binary ?? process.env.SPECFLEET_COPILOT_BINARY ?? "copilot";

  await ensureDir(opts.runsDir);
  const transcript = path.join(opts.runsDir, `${runId}.jsonl`);
  const handle = await fs.open(transcript, "a");
  const pendingWrites: Array<Promise<unknown>> = [];

  const writeEvent = async (kind: string, payload: Record<string, unknown> = {}) => {
    const line =
      JSON.stringify({
        ts: new Date().toISOString(),
        runId,
        charter: opts.agent ?? "",
        phase: opts.phase ?? "freeform",
        kind,
        payload,
      }) + "\n";
    await handle.write(line);
  };

  await writeEvent("start", {
    binary,
    argv,
    specId: opts.specId,
    promptBytes: Buffer.byteLength(opts.prompt, "utf8"),
  });

  const started = Date.now();
  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn(binary, argv, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err) {
    await writeEvent("exit", { code: -1, error: (err as Error).message });
    await handle.close();
    throw new Error(
      `dispatch: failed to spawn "${binary}". Is the Copilot CLI installed and on $PATH? ` +
        `Original error: ${(err as Error).message}`,
    );
  }

  child.stdin.end(opts.prompt);

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
    pendingWrites.push(writeEvent("stdout", { chunk }).catch((err) => err));
    if (opts.inherit !== false) process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
    pendingWrites.push(writeEvent("stderr", { chunk }).catch((err) => err));
    if (opts.inherit !== false) process.stderr.write(chunk);
  });

  let timer: NodeJS.Timeout | null = null;
  if (opts.timeoutMs && opts.timeoutMs > 0) {
    timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, opts.timeoutMs);
  }

  const exitCode: number = await new Promise((resolve) => {
    child.on("close", (code) => resolve(code ?? 0));
  });

  if (timer) clearTimeout(timer);

  const durationMs = Date.now() - started;
  await Promise.all(pendingWrites);
  await writeEvent("exit", { code: exitCode, durationMs, stdoutBytes: stdout.length, stderrBytes: stderr.length });
  await handle.close();

  return { runId, exitCode, stdout, stderr, durationMs, argv, transcript };
}

/**
 * Build the argv we hand to Copilot CLI. Exposed for testing — keep it pure.
 *
 * Conventions (consistent with `copilot --help`):
 *   • prompt text is read from stdin (we set `-p -` so Copilot reads stdin)
 *   • each `--allow-tool` adds one allowlisted tool
 *   • `--no-interactive` disables TTY prompts
 *   • `--agent <name>` activates a `.github/agents/<name>.agent.md`
 *   • `--model <id>` overrides the workspace default
 */
export function buildArgv(opts: DispatchOptions): string[] {
  const argv: string[] = ["-p", "-"];
  if (opts.nonInteractive) argv.push("--no-interactive");
  if (opts.agent) argv.push("--agent", opts.agent);
  if (opts.model) argv.push("--model", opts.model);
  for (const t of opts.allowTool ?? []) argv.push("--allow-tool", t);
  return argv;
}
