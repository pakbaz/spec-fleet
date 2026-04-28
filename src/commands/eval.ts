/**
 * `eas eval` — Continuous evaluation harness. Runs benchmark prompts against
 * charters and scores the results against expectations declared in the
 * benchmark frontmatter. Appends one JSONL row per result to
 * `.eas/eval/scoreboard.jsonl`.
 *
 * Set EAS_EVAL_MOCK=1 to bypass the SDK and echo the prompt as the result —
 * lets the harness run offline (used by tests and pack-smoke).
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import fg from "fast-glob";
import matter from "gray-matter";
import { EasRuntime } from "../runtime/index.js";
import { ensureDir } from "../util/paths.js";

const __filename = fileURLToPath(import.meta.url);
// dist/commands/eval.js → ../../templates/benchmarks
const STARTER_BENCH = path.resolve(path.dirname(__filename), "..", "..", "templates", "benchmarks");

export interface EvalOptions {
  charter?: string;
  bench?: string;
  limit?: number;
}

interface BenchmarkExpect {
  contains?: string[];
  not_contains?: string[];
  max_tool_calls?: number;
}

interface Benchmark {
  id: string;
  charter: string;
  prompt: string;
  expect: BenchmarkExpect;
  file: string;
}

interface EvalResult {
  ts: string;
  id: string;
  charter: string;
  pass: boolean;
  failures: string[];
  duration_ms: number;
}

export async function evalCommand(opts: EvalOptions = {}): Promise<EvalResult[]> {
  const rt = await EasRuntime.open();
  try {
    const evalDir = path.join(rt.paths.easDir, "eval");
    const benchDir = opts.bench ? path.resolve(opts.bench) : path.join(evalDir, "benchmarks");
    await ensureDir(benchDir);
    let benchmarks = await loadBenchmarks(benchDir);
    if (benchmarks.length === 0) {
      // Fall back to starter pack so first run isn't empty.
      benchmarks = await loadBenchmarks(STARTER_BENCH);
    }
    if (opts.charter) benchmarks = benchmarks.filter((b) => b.charter === opts.charter);
    if (opts.limit) benchmarks = benchmarks.slice(0, opts.limit);

    const scoreboard = path.join(evalDir, "scoreboard.jsonl");
    await ensureDir(path.dirname(scoreboard));

    const results: EvalResult[] = [];
    for (const b of benchmarks) {
      const started = Date.now();
      let output: string;
      let toolCalls = 0;
      try {
        if (process.env.EAS_EVAL_MOCK === "1") {
          output = b.prompt;
        } else {
          const r = await rt.delegate(rt.rootCharter().name, b.charter, b.prompt);
          output = r.output;
          // Tool-call counting is best-effort; future SDK telemetry will fill this in.
        }
      } catch (err) {
        output = `ERROR: ${(err as Error).message}`;
      }

      const failures = score(output, b.expect, toolCalls);
      const result: EvalResult = {
        ts: new Date().toISOString(),
        id: b.id,
        charter: b.charter,
        pass: failures.length === 0,
        failures,
        duration_ms: Date.now() - started,
      };
      await fs.appendFile(scoreboard, JSON.stringify(result) + "\n", "utf8");
      results.push(result);
      const tag = result.pass ? chalk.green("PASS") : chalk.red("FAIL");
      console.log(`${tag} ${b.charter.padEnd(14)} ${b.id}${failures.length ? ` — ${failures.join("; ")}` : ""}`);
    }
    return results;
  } finally {
    await rt.dispose();
  }
}

function score(output: string, expect: BenchmarkExpect, toolCalls: number): string[] {
  const failures: string[] = [];
  for (const c of expect.contains ?? []) {
    if (!output.includes(c)) failures.push(`missing:"${c}"`);
  }
  for (const c of expect.not_contains ?? []) {
    if (output.includes(c)) failures.push(`forbidden:"${c}"`);
  }
  if (typeof expect.max_tool_calls === "number" && toolCalls > expect.max_tool_calls) {
    failures.push(`tool_calls=${toolCalls}>${expect.max_tool_calls}`);
  }
  return failures;
}

async function loadBenchmarks(dir: string): Promise<Benchmark[]> {
  const files = await fg("*.md", { cwd: dir, absolute: true });
  const out: Benchmark[] = [];
  for (const f of files) {
    const raw = await fs.readFile(f, "utf8");
    const fm = matter(raw);
    const data = fm.data as Partial<Benchmark> & { expect?: BenchmarkExpect };
    if (!data.id || !data.charter || !data.prompt) continue;
    out.push({
      id: data.id,
      charter: data.charter,
      prompt: data.prompt,
      expect: data.expect ?? {},
      file: f,
    });
  }
  return out;
}
