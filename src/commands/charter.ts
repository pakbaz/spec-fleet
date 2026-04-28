/**
 * `eas charter new|list|validate`
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import chalk from "chalk";
import { EasRuntime } from "../runtime/index.js";
import { loadAllCharters } from "../runtime/charter.js";
import { findEasRoot, easPaths, ensureDir } from "../util/paths.js";

interface CharterOptions {
  name?: string;
}

export async function charterCommand(action: "new" | "list" | "validate", opts: CharterOptions): Promise<void> {
  if (action === "new") {
    const name = opts.name;
    if (!name) throw new Error("charter name required (e.g. dev/frontend)");
    const root = await findEasRoot();
    const p = easPaths(root);
    const file = path.join(p.chartersDir, `${name.includes("/") ? `subagents/${name}` : name}.charter.md`);
    await ensureDir(path.dirname(file));
    try {
      await fs.stat(file);
      throw new Error(`charter already exists: ${file}`);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    const tier = name.includes("/") ? "subagent" : "role";
    const role = name.split("/")[0] ?? "dev";
    const body = scaffold({ name, displayName: name, role, tier });
    await fs.writeFile(file, body, "utf8");
    console.log(chalk.green(`✓ Created ${path.relative(process.cwd(), file)}`));
    return;
  }

  if (action === "list") {
    const rt = await EasRuntime.open();
    try {
      for (const c of rt.listCharters()) {
        console.log(`${c.tier.padEnd(12)} ${chalk.cyan(c.name.padEnd(30))} cap=${c.maxContextTokens} role=${c.role}`);
      }
    } finally {
      await rt.dispose();
    }
    return;
  }

  if (action === "validate") {
    const root = await findEasRoot();
    const p = easPaths(root);
    const charters = await loadAllCharters(p.chartersDir);
    console.log(chalk.green(`✓ ${charters.length} charter(s) valid`));
    return;
  }
}

function scaffold(meta: { name: string; displayName: string; role: string; tier: string }): string {
  return `---
name: ${meta.name}
displayName: ${meta.displayName}
role: ${meta.role}
tier: ${meta.tier}
description: TODO — describe this agent in one sentence.
maxContextTokens: 80000
allowedTools: []
spawns: []
mcpServers: []
skills: []
requiresHumanGate: false
---

# ${meta.displayName}

You are the ${meta.displayName} agent. TODO: describe responsibilities.

## Inputs
- Brief from your parent agent.

## Outputs
- Concise structured response.

## Constraints
- Stay within your token budget.
- Only use tools you are explicitly allowed.
`;
}
