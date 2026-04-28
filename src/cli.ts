#!/usr/bin/env node
/**
 * eas — Enterprise Agents System CLI
 */
import { Command } from "commander";
import chalk from "chalk";
import { initCommand } from "./commands/init.js";
import { onboardCommand } from "./commands/onboard.js";
import { planCommand } from "./commands/plan.js";
import { implementCommand } from "./commands/implement.js";
import { statusCommand } from "./commands/status.js";
import { auditCommand } from "./commands/audit.js";
import { charterCommand } from "./commands/charter.js";
import { doctorCommand } from "./commands/doctor.js";
import { reviewCommand } from "./commands/review.js";

const program = new Command();

program
  .name("eas")
  .description("Enterprise Agents System — autonomous ALM with hierarchical Copilot agents")
  .version("0.1.0");

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
  .command("plan <goal...>")
  .description("Decompose a goal into tasks across role agents")
  .option("--out <path>", "Write plan to file (default: .eas/plans/<timestamp>.md)")
  .action((goal: string[], opts) => planCommand(goal.join(" "), opts));

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

program
  .command("audit")
  .description("Stream audit events")
  .option("--since <iso>", "Only events after this ISO timestamp")
  .option("--agent <name>", "Filter by agent name")
  .option("--tail", "Follow new events (like tail -f)")
  .action(auditCommand);

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

program.parseAsync(process.argv).catch((err: Error) => {
  console.error(chalk.red(`✖ ${err.message}`));
  if (process.env.EAS_DEBUG) console.error(err.stack);
  process.exit(1);
});
