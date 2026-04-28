#!/usr/bin/env node
/**
 * eas — Enterprise Agents System CLI
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import chalk from "chalk";
import { initCommand } from "./commands/init.js";
import { onboardCommand } from "./commands/onboard.js";
import { planCommand } from "./commands/plan.js";
import { implementCommand } from "./commands/implement.js";
import { statusCommand } from "./commands/status.js";
import { auditCommand, auditVerifyCommand } from "./commands/audit.js";
import { charterCommand } from "./commands/charter.js";
import { doctorCommand } from "./commands/doctor.js";
import { reviewCommand } from "./commands/review.js";
import { mcpServeCommand } from "./commands/mcp-serve.js";
import { specCommand } from "./commands/spec.js";
import { sreCommand } from "./commands/sre.js";
import { evalCommand } from "./commands/eval.js";
import { tuneCommand } from "./commands/tune.js";
import { replayCommand } from "./commands/replay.js";
import { installHooksCommand } from "./commands/install-hooks.js";
import { precommitScanCommand } from "./commands/precommit-scan.js";

// Read version from package.json so `eas --version` is always in sync with publish.
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

program
  .command("init")
  .description("Bootstrap .eas/ in a new repo (greenfield) and run the guided interview")
  .option("-d, --dir <path>", "Target directory (default: cwd)")
  .option("--non-interactive", "Skip the guided interview (use defaults)")
  .option("--instruction <path>", "Path to a corporate instruction.md to copy in")
  .action(initCommand);

program
  .command("onboard")
  .description("Brownfield: index codebase, draft project.md, run compliance audit")
  .option("-d, --dir <path>", "Target directory (default: cwd)")
  .action(onboardCommand);

program
  .command("plan [goal...]")
  .description("Decompose a goal into tasks across role agents")
  .option("--out <path>", "Write plan to file (default: .eas/plans/<timestamp>.md)")
  .option("--from-spec <id>", "Seed the plan from .eas/specs/<id>.spec.md")
  .action((goal: string[], opts) => planCommand((goal ?? []).join(" "), opts));

program
  .command("implement")
  .description("Execute the next ready task (or all) with autopilot + human gates")
  .option("--task <id>", "Run a specific task ID")
  .option("--all", "Run every ready task to completion")
  .option("--no-gates", "Disable human approval gates (dangerous)")
  .action(implementCommand);

program
  .command("review")
  .description("Compliance + Architect re-review of pending changes")
  .action(reviewCommand);

program
  .command("status")
  .description("Show active sessions, subagent tasks, and gates awaiting approval")
  .action(statusCommand);

const audit = program.command("audit").description("Audit log operations");
audit
  .command("tail", { isDefault: true })
  .description("Stream / filter audit events")
  .option("--since <iso>", "Only events after this ISO timestamp")
  .option("--agent <name>", "Filter by agent name")
  .option("--tail", "Follow new events (like tail -f)")
  .action(auditCommand);
audit
  .command("verify")
  .description("Recompute the per-session hash chain and report tamper-evidence status")
  .option("--session <id>", "Verify a single session")
  .option("--all", "Verify every session under .eas/audit/")
  .action(auditVerifyCommand);

const charter = program.command("charter").description("Manage agent charters");
charter
  .command("new <name>")
  .description("Scaffold a new charter (e.g. dev/frontend)")
  .action((name: string) => charterCommand("new", { name }));
charter
  .command("list")
  .description("List all charters")
  .action(() => charterCommand("list", {}));
charter
  .command("validate")
  .description("Validate charter frontmatter against schema")
  .action(() => charterCommand("validate", {}));

program
  .command("doctor")
  .description("Validate .eas/ integrity, charter caps, MCP scopes, and policy hooks")
  .action(doctorCommand);

const mcp = program.command("mcp").description("Model Context Protocol integrations");
mcp
  .command("serve")
  .description("Run the EAS MCP server over stdio (decisions/charters/project/audit)")
  .option("-d, --dir <path>", "Project root (default: cwd)")
  .action((opts) => mcpServeCommand(opts));

const spec = program.command("spec").description("Author and list specs (GSD / Spec-Kit shape)");
spec
  .command("new <name>")
  .description("Scaffold a new spec under .eas/specs/")
  .action((name: string) => specCommand("new", { name }));
spec
  .command("list")
  .description("List all specs")
  .action(() => specCommand("list", {}));

const sre = program.command("sre").description("SRE operations");
sre
  .command("triage")
  .description("Triage recent failures (audit + optional SARIF) via the sre charter")
  .option("--sarif <path>", "Path to a SARIF file (defaults to globbing **/*.sarif)")
  .action((opts) => sreCommand("triage", opts));

program
  .command("eval")
  .description("Run the evaluation harness against benchmarks")
  .option("--charter <role>", "Only run benchmarks for this charter")
  .option("--bench <path>", "Custom benchmarks dir (default: .eas/eval/benchmarks)")
  .option("--limit <n>", "Cap number of benchmarks", (v) => parseInt(v, 10))
  .action(async (opts) => {
    await evalCommand(opts);
  });

program
  .command("tune")
  .description("Aggregate eval failures and emit advisory charter-edit diff")
  .option("--since <iso>", "Only include scoreboard rows after this ISO timestamp")
  .action(async (opts) => {
    await tuneCommand(opts);
  });

program
  .command("replay <sessionId>")
  .description("Replay an audit session as a redacted timeline (read-only)")
  .option("--from <seq>", "Start sequence index", (v) => parseInt(v, 10))
  .option("--limit <n>", "Max events to print", (v) => parseInt(v, 10))
  .action((sessionId: string, opts) => replayCommand(sessionId, opts));

program
  .command("install-hooks")
  .description("Install a git pre-commit hook that runs the EAS staged-diff scanner")
  .option("-d, --dir <path>", "Repository root (default: cwd)")
  .option("--force", "Overwrite an existing pre-commit hook")
  .action(installHooksCommand);

program
  .command("precommit-scan")
  .description("Scan the staged git diff for secrets and IP-guard matches (used by the pre-commit hook)")
  .action(precommitScanCommand);

program.parseAsync(process.argv).catch((err: Error) => {
  console.error(chalk.red(`✖ ${err.message}`));
  if (process.env.EAS_DEBUG) console.error(err.stack);
  process.exit(1);
});
