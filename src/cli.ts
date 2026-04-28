#!/usr/bin/env node
/**
 * specfleet — SpecFleet CLI (v0.4 surface)
 *
 * 10 visible commands:
 *   Lifecycle:   init · plan · run · review · status
 *   Reflection:  check · log · config · spec
 *   Services:    mcp serve   (+ specialized: sre triage)
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import chalk from "chalk";

import { initCommand } from "./commands/init.js";
import { planCommand } from "./commands/plan.js";
import { runCommand } from "./commands/run.js";
import { statusCommand } from "./commands/status.js";
import { reviewCommand } from "./commands/review.js";
import { checkCommand } from "./commands/check.js";
import { logCommand } from "./commands/log.js";
import { configCommand } from "./commands/config.js";
import { mcpServeCommand } from "./commands/mcp-serve.js";
import { specCommand } from "./commands/spec.js";
import { sreCommand } from "./commands/sre.js";

const __filename = fileURLToPath(import.meta.url);
// dist/cli.js -> ../package.json
const PKG_VERSION = (() => {
  try {
    const pkgPath = join(dirname(__filename), "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

const program = new Command();

program
  .name("specfleet")
  .description("SpecFleet — autonomous ALM with hierarchical Copilot agents")
  .version(PKG_VERSION)
  .option("--offline", "Air-gap mode: deny all egress regardless of allowlist")
  .hook("preAction", (thisCmd) => {
    if (thisCmd.opts().offline) process.env.SPECFLEET_OFFLINE = "1";
  });

// =====================================================================
// Lifecycle (5 verbs)
// =====================================================================

program
  .command("init")
  .description("Bootstrap or upgrade .specfleet/ — detects greenfield / brownfield / existing repos")
  .option("-d, --dir <path>", "Target directory (default: cwd)")
  .option(
    "--mode <mode>",
    "Skip the prompt: greenfield | brownfield | modify | upgrade | overwrite",
  )
  .option("--non-interactive", "Skip prompts and the guided interview (use safe defaults)")
  .option("--instruction <path>", "Path to a corporate instruction.md to copy in")
  .option("--no-hooks", "Don't install the git pre-commit hook")
  .option("--hooks-only", "Just (re)install the git pre-commit hook and exit")
  .option("--force", "Required for --mode overwrite")
  .action(initCommand);

program
  .command("plan [goal...]")
  .description("Decompose a goal into tasks across role agents")
  .option("--out <path>", "Write plan to file (default: .specfleet/plans/<timestamp>.md)")
  .option("--from-spec <id>", "Seed the plan from .specfleet/specs/<id>.spec.md")
  .action((goal: string[], opts) => planCommand((goal ?? []).join(" "), opts));

program
  .command("run")
  .description("Execute the next ready task (or all) with autopilot + human gates")
  .option("--task <id>", "Run a specific task ID")
  .option("--all", "Run every ready task to completion")
  .option("--no-gates", "Disable human approval gates (dangerous)")
  .action(runCommand);

program
  .command("review")
  .description("Compliance + Architect re-review of pending changes")
  .action(reviewCommand);

program
  .command("status")
  .description("Show active sessions, subagent tasks, and gates awaiting approval")
  .action(statusCommand);

// =====================================================================
// Reflection (4 verbs)
// =====================================================================

program
  .command("check")
  .description("Health & quality: doctor + chain verify (default), --eval, --tune, --staged, --deep")
  .option("--deep", "Run doctor + audit-chain verify across all sessions")
  .option("--audit", "Only run audit-chain verify")
  .option("--session <id>", "(--audit) Verify one audit session")
  .option("--all", "(--audit) Verify every audit session")
  .option("--eval", "Run the evaluation harness against benchmarks")
  .option("--tune", "Aggregate eval failures and emit advisory charter-edit diff")
  .option("--staged", "Scan the staged git diff (used by the pre-commit hook)")
  .option("--fix", "Auto-fix trivial drift (e.g. re-mirror charters)")
  .option("--charter <role>", "(--eval) Only run benchmarks for this charter")
  .option("--bench <path>", "(--eval) Custom benchmarks dir")
  .option("--limit <n>", "(--eval) Cap number of benchmarks", (v) => parseInt(v, 10))
  .option("--since <iso>", "(--tune) Only include scoreboard rows after this timestamp")
  .action(checkCommand);

program
  .command("log [sessionId]")
  .description("Tail audit events (no arg) or replay a session as a redacted timeline")
  .option("--since <iso>", "(tail) Only events after this ISO timestamp")
  .option("--agent <name>", "(tail) Filter by agent name")
  .option("--tail", "(tail) Follow new events (like tail -f)")
  .option("--from <seq>", "(replay) Start sequence index", (v) => parseInt(v, 10))
  .option("--limit <n>", "(replay) Max events to print", (v) => parseInt(v, 10))
  .action((sessionId: string | undefined, opts) => logCommand(sessionId, opts));

const config = program
  .command("config")
  .description("Inspect & edit orchestrator instructions, charters, policies, MCP, skills");
config
  .command("show [target]")
  .description('Print one config (default: orchestrator). e.g. "dev", "policy:egress"')
  .option("--no-redact", "Don't redact secret patterns when printing")
  .action((target: string | undefined, opts) =>
    configCommand("show", target, { noRedact: opts.redact === false }),
  );
config
  .command("list")
  .description("Table of every wired config (kind / name / path / modified)")
  .action(() => configCommand("list", undefined));
config
  .command("edit [target]")
  .description("Open in $EDITOR; re-validates on close")
  .action((target: string | undefined) => configCommand("edit", target));
config
  .command("new <kind> <name>")
  .description("Scaffold a new config. Kinds: charter | policy | mcp | skill")
  .action((kind: string, name: string) => configCommand("new", undefined, { kind, name }));
config
  .command("validate")
  .description("Schema-check every config; exits non-zero on failure")
  .action(() => configCommand("validate", undefined));
config
  .command("diff")
  .description("Drift between local configs and bundled reference templates")
  .action(() => configCommand("diff", undefined));

const spec = program.command("spec").description("Author and list specs (GSD / Spec-Kit shape)");
spec
  .command("new <name>")
  .description("Scaffold a new spec under .specfleet/specs/")
  .action((name: string) => specCommand("new", { name }));
spec
  .command("list")
  .description("List all specs")
  .action(() => specCommand("list", {}));

// =====================================================================
// Services
// =====================================================================

const mcp = program.command("mcp").description("Model Context Protocol integrations");
mcp
  .command("serve")
  .description("Run the SpecFleet MCP server over stdio")
  .option("-d, --dir <path>", "Project root (default: cwd)")
  .action((opts) => mcpServeCommand(opts));

const sre = program.command("sre").description("SRE operations");
sre
  .command("triage")
  .description("Triage recent failures (audit + optional SARIF) via the sre charter")
  .option("--sarif <path>", "Path to a SARIF file (defaults to globbing **/*.sarif)")
  .action((opts) => sreCommand("triage", opts));

program.parseAsync(process.argv).catch((err: Error) => {
  console.error(chalk.red(`✖ ${err.message}`));
  if (process.env.SPECFLEET_DEBUG) console.error(err.stack);
  process.exit(1);
});
