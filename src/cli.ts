#!/usr/bin/env node
/**
 * eas — Enterprise Agents System CLI (v0.3 surface)
 *
 * 10 visible commands:
 *   Lifecycle:   init · plan · run · review · status
 *   Reflection:  check · log · config · spec
 *   Services:    mcp serve   (+ specialized: sre triage)
 *
 * Hidden deprecated aliases (removed in v0.4):
 *   onboard, implement, doctor, audit, replay, eval, tune, precommit-scan,
 *   install-hooks, charter
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import chalk from "chalk";

import { initCommand } from "./commands/init.js";
import { onboardCommand } from "./commands/onboard.js";
import { planCommand } from "./commands/plan.js";
import { runCommand } from "./commands/run.js";
import { implementCommand } from "./commands/implement.js";
import { statusCommand } from "./commands/status.js";
import { reviewCommand } from "./commands/review.js";
import { checkCommand } from "./commands/check.js";
import { logCommand } from "./commands/log.js";
import { configCommand } from "./commands/config.js";
import { auditCommand, auditVerifyCommand } from "./commands/audit.js";
import { charterCommand } from "./commands/charter.js";
import { doctorCommand } from "./commands/doctor.js";
import { mcpServeCommand } from "./commands/mcp-serve.js";
import { specCommand } from "./commands/spec.js";
import { sreCommand } from "./commands/sre.js";
import { evalCommand } from "./commands/eval.js";
import { tuneCommand } from "./commands/tune.js";
import { replayCommand } from "./commands/replay.js";
import { installHooksCommand } from "./commands/install-hooks.js";
import { precommitScanCommand } from "./commands/precommit-scan.js";
import { warnDeprecated } from "./util/deprecate.js";

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
  .name("eas")
  .description("Enterprise Agents System — autonomous ALM with hierarchical Copilot agents")
  .version(PKG_VERSION)
  .option("--offline", "Air-gap mode: deny all egress regardless of allowlist")
  .hook("preAction", (thisCmd) => {
    if (thisCmd.opts().offline) process.env.EAS_OFFLINE = "1";
  });

// =====================================================================
// Lifecycle (5 verbs)
// =====================================================================

program
  .command("init")
  .description("Bootstrap or upgrade .eas/ — detects greenfield / brownfield / existing repos")
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
  .option("--out <path>", "Write plan to file (default: .eas/plans/<timestamp>.md)")
  .option("--from-spec <id>", "Seed the plan from .eas/specs/<id>.spec.md")
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
  .description("Scaffold a new spec under .eas/specs/")
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
  .description("Run the EAS MCP server over stdio")
  .option("-d, --dir <path>", "Project root (default: cwd)")
  .action((opts) => mcpServeCommand(opts));

const sre = program.command("sre").description("SRE operations");
sre
  .command("triage")
  .description("Triage recent failures (audit + optional SARIF) via the sre charter")
  .option("--sarif <path>", "Path to a SARIF file (defaults to globbing **/*.sarif)")
  .action((opts) => sreCommand("triage", opts));

// =====================================================================
// Hidden deprecated aliases (removed in v0.4)
// =====================================================================

// onboard → init --mode brownfield
program
  .command("onboard", { hidden: true })
  .option("-d, --dir <path>")
  .action(async (opts) => {
    warnDeprecated("onboard", "init --mode brownfield");
    await onboardCommand(opts);
  });

// implement → run
program
  .command("implement", { hidden: true })
  .option("--task <id>")
  .option("--all")
  .option("--no-gates")
  .action(async (opts) => {
    warnDeprecated("implement", "run");
    await implementCommand(opts);
  });

// doctor → check
program
  .command("doctor", { hidden: true })
  .action(async () => {
    warnDeprecated("doctor", "check");
    await doctorCommand();
  });

// audit (tail/verify) → log / check --audit
const auditAlias = program
  .command("audit", { hidden: true })
  .description("(deprecated) use `eas log` or `eas check --audit`");
auditAlias
  .command("tail", { isDefault: true })
  .option("--since <iso>")
  .option("--agent <name>")
  .option("--tail")
  .action(async (opts) => {
    warnDeprecated("audit tail", "log");
    await auditCommand(opts);
  });
auditAlias
  .command("verify")
  .option("--session <id>")
  .option("--all")
  .action(async (opts) => {
    warnDeprecated("audit verify", "check --audit");
    await auditVerifyCommand(opts);
  });

// replay → log <id>
program
  .command("replay <sessionId>", { hidden: true })
  .option("--from <seq>", "Start sequence index", (v: string) => parseInt(v, 10))
  .option("--limit <n>", "Max events to print", (v: string) => parseInt(v, 10))
  .action(async (sessionId: string, opts) => {
    warnDeprecated("replay", "log <sessionId>");
    await replayCommand(sessionId, opts);
  });

// eval → check --eval
program
  .command("eval", { hidden: true })
  .option("--charter <role>")
  .option("--bench <path>")
  .option("--limit <n>", "Cap number of benchmarks", (v: string) => parseInt(v, 10))
  .action(async (opts) => {
    warnDeprecated("eval", "check --eval");
    await evalCommand(opts);
  });

// tune → check --tune
program
  .command("tune", { hidden: true })
  .option("--since <iso>")
  .action(async (opts) => {
    warnDeprecated("tune", "check --tune");
    await tuneCommand(opts);
  });

// precommit-scan → check --staged   (kept forever — already-installed hooks call this)
program
  .command("precommit-scan", { hidden: true })
  .description("(internal) staged-diff scanner used by the git pre-commit hook")
  .action(precommitScanCommand);

// install-hooks → init --hooks-only
program
  .command("install-hooks", { hidden: true })
  .option("-d, --dir <path>")
  .option("--force")
  .action(async (opts) => {
    warnDeprecated("install-hooks", "init --hooks-only");
    await installHooksCommand(opts);
  });

// charter → config
const charterAlias = program
  .command("charter", { hidden: true })
  .description("(deprecated) use `eas config`");
charterAlias.command("new <name>").action(async (name: string) => {
  warnDeprecated("charter new", "config new charter <name>");
  await charterCommand("new", { name });
});
charterAlias.command("list").action(async () => {
  warnDeprecated("charter list", "config list");
  await charterCommand("list", {});
});
charterAlias.command("validate").action(async () => {
  warnDeprecated("charter validate", "config validate");
  await charterCommand("validate", {});
});

// =====================================================================

program.parseAsync(process.argv).catch((err: Error) => {
  console.error(chalk.red(`✖ ${err.message}`));
  if (process.env.EAS_DEBUG) console.error(err.stack);
  process.exit(1);
});
