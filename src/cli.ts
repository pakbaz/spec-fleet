#!/usr/bin/env node
/**
 * specfleet — SpecFleet CLI v0.6
 *
 * Spec-Kit pipeline (8 verbs):
 *   specify · clarify · plan · tasks · analyze · implement · review · checklist
 *
 * Operations (3 verbs):
 *   init · check · config
 *
 * Services:
 *   mcp serve
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";

import { initCommand } from "./commands/init.js";
import { checkCommand } from "./commands/check.js";
import { configCommand } from "./commands/config.js";
import { mcpServeCommand } from "./commands/mcp-serve.js";

import { specifyCommand } from "./commands/specify.js";
import { clarifyCommand } from "./commands/clarify.js";
import { planCommand } from "./commands/plan.js";
import { tasksCommand } from "./commands/tasks.js";
import { analyzeCommand } from "./commands/analyze.js";
import { implementCommand } from "./commands/implement.js";
import { reviewCommand } from "./commands/review.js";
import { checklistCommand } from "./commands/checklist.js";

const __filename = fileURLToPath(import.meta.url);
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
  .description("SpecFleet — a thin Spec-Kit pipeline over GitHub Copilot CLI")
  .version(PKG_VERSION);

// ---------- Operations ----------

program
  .command("init")
  .description("Bootstrap or upgrade .specfleet/ + .github/ scaffolding")
  .option("-d, --dir <path>", "Target directory (default: cwd)")
  .option("--mode <mode>", "greenfield | brownfield | upgrade | overwrite")
  .option("--non-interactive", "Use safe defaults; no prompts")
  .option("--instruction <path>", "Path to a corporate instruction.md")
  .option("--from-v5", "Migrate an existing v0.5 .specfleet/ in place")
  .option("--force", "Required for --mode overwrite")
  .action(initCommand);

program
  .command("check")
  .description("Validate charters, mirror, MCP manifests, and Copilot CLI availability")
  .option("--staged", "Run secrets scanner on staged files (pre-commit hook)")
  .option("--fix", "Re-mirror charters when missing")
  .action(checkCommand);

const config = program
  .command("config")
  .description("Inspect and edit .specfleet/config.json");

config
  .command("show", { isDefault: true })
  .description("Print the resolved workspace config")
  .action(() => configCommand("show"));

config
  .command("set <key> <value>")
  .description("Set a dotted key (e.g. models.review=gpt-5.1)")
  .action((key: string, value: string) => configCommand("set", { key, value }));

config
  .command("list")
  .description("List charters, prompts, instructions, and MCP servers")
  .action(() => configCommand("list"));

const mcp = program.command("mcp").description("MCP services");
mcp
  .command("serve")
  .description("Run the SpecFleet MCP server (stdio JSON-RPC)")
  .option("-d, --dir <path>", "Workspace root (default: search from cwd)")
  .action(mcpServeCommand);

// ---------- Pipeline ----------

program
  .command("specify <name>")
  .description("Phase 1 — draft a new spec under .specfleet/specs/<id>/spec.md")
  .option("--description <text>", "One-line description seed")
  .option("--charter <name>", "Override the charter (default: orchestrator)")
  .option("--model <id>", "Override the model")
  .option("--allow-tool <name>", "Allow a Copilot tool for this dispatch (repeatable)", collect)
  .option("--non-interactive", "Pass --no-interactive to Copilot")
  .option("--dry-run", "Print response without writing artefacts")
  .action((name: string, opts) => specifyCommand(name, opts));

program
  .command("clarify <spec-id>")
  .description("Phase 2 — surface ambiguous requirements as clarifying questions")
  .option("--charter <name>", "Override the charter")
  .option("--model <id>", "Override the model")
  .option("--allow-tool <name>", "Allow a Copilot tool for this dispatch (repeatable)", collect)
  .option("--non-interactive", "Pass --no-interactive to Copilot")
  .option("--answer <q-and-a>", "Pre-supplied answers (repeatable)", collect, [])
  .option("--dry-run", "Print without writing")
  .action((specId: string, opts) =>
    clarifyCommand(specId, {
      charter: opts.charter,
      answers: opts.answer,
      model: opts.model,
      allowTool: opts.allowTool,
      nonInteractive: opts.nonInteractive,
      dryRun: opts.dryRun,
    }),
  );

program
  .command("plan <spec-id>")
  .description("Phase 3 — produce an architecture plan")
  .option("--charter <name>", "Override the charter (default: architect)")
  .option("--model <id>", "Override the model")
  .option("--allow-tool <name>", "Allow a Copilot tool for this dispatch (repeatable)", collect)
  .option("--non-interactive", "Pass --no-interactive to Copilot")
  .option("--dry-run", "Print without writing")
  .action((specId: string, opts) => planCommand(specId, opts));

program
  .command("tasks <spec-id>")
  .description("Phase 4 — decompose plan into ordered tasks")
  .option("--charter <name>", "Override the charter")
  .option("--model <id>", "Override the model")
  .option("--allow-tool <name>", "Allow a Copilot tool for this dispatch (repeatable)", collect)
  .option("--non-interactive", "Pass --no-interactive to Copilot")
  .option("--dry-run", "Print without writing")
  .action((specId: string, opts) => tasksCommand(specId, opts));

program
  .command("analyze <spec-id>")
  .description("Phase 5 — pre-implementation risk analysis")
  .option("--charter <name>", "Override the charter (default: architect)")
  .option("--model <id>", "Override the model")
  .option("--allow-tool <name>", "Allow a Copilot tool for this dispatch (repeatable)", collect)
  .option("--non-interactive", "Pass --no-interactive to Copilot")
  .option("--dry-run", "Print without writing")
  .action((specId: string, opts) => analyzeCommand(specId, opts));

program
  .command("implement <spec-id>")
  .description("Phase 6 — execute tasks.md (default charter: dev)")
  .option("--charter <name>", "Override the charter (default: dev)")
  .option("--model <id>", "Override the model")
  .option("--allow-tool <name>", "Allow a Copilot tool for this dispatch (repeatable)", collect)
  .option("--non-interactive", "Pass --no-interactive to Copilot")
  .option("--task <id>", "Focus on a specific task id")
  .option("--dry-run", "Print without applying")
  .action((specId: string, opts) => implementCommand(specId, opts));

program
  .command("review <spec-id>")
  .description("Phase 7 — cross-model review (default uses config.models.review)")
  .option("--charter <name>", "Override the charter (default: architect)")
  .option("--model <id>", "Override the review model")
  .option("--allow-tool <name>", "Allow a Copilot tool for this dispatch (repeatable)", collect)
  .option("--non-interactive", "Pass --no-interactive to Copilot")
  .option("--same-model", "Force same model as implement (skip cross-model)")
  .option("--dry-run", "Print without writing")
  .action((specId: string, opts) => reviewCommand(specId, opts));

program
  .command("checklist <spec-id>")
  .description("Phase 8 — post-implement drift detection (compliance)")
  .option("--charter <name>", "Override the charter (default: compliance)")
  .option("--model <id>", "Override the model")
  .option("--allow-tool <name>", "Allow a Copilot tool for this dispatch (repeatable)", collect)
  .option("--non-interactive", "Pass --no-interactive to Copilot")
  .option("--dry-run", "Print without writing")
  .action((specId: string, opts) => checklistCommand(specId, opts));

// ---------- helpers ----------

function collect(value: string, prev: string[] = []): string[] {
  return [...prev, value];
}

program.parseAsync(process.argv).catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`error: ${msg}`);
  process.exit(1);
});
