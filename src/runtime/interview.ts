/**
 * Architect guided interview — collects project metadata via stdin (or prefilled
 * answers from EAS_INTERVIEW_JSON for non-interactive smoke tests) and writes
 * .eas/project.md.
 *
 * In a future phase this will be implemented as a real EAS subagent that asks the
 * user via session.ui.elicitation. For MVP we use a deterministic interview to
 * keep tests stable.
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import matter from "gray-matter";
import { easPaths } from "../util/paths.js";
import { ProjectSchema, type Project } from "../schema/index.js";

export async function runInterview(root: string): Promise<Project> {
  const p = easPaths(root);
  let answers: Partial<Project> | null = null;

  // Test escape hatch: EAS_INTERVIEW_JSON='{...}' bypasses prompts.
  if (process.env.EAS_INTERVIEW_JSON) {
    answers = JSON.parse(process.env.EAS_INTERVIEW_JSON) as Partial<Project>;
  } else if (input.isTTY) {
    answers = await prompt();
  } else {
    // Non-TTY without env var: emit a stub project so downstream commands work.
    answers = {
      name: path.basename(root),
      mode: "greenfield",
      description: "Auto-generated stub (no interview).",
      primaryLanguage: "typescript",
      runtime: "node20",
    };
  }

  const project = ProjectSchema.parse({
    name: path.basename(root),
    mode: "greenfield",
    primaryLanguage: "typescript",
    runtime: "node20",
    description: "TODO: describe the project",
    ...answers,
  });

  const md = matter.stringify(
    `# ${project.name}\n\n${project.description}\n`,
    project as unknown as Record<string, unknown>,
  );
  await fs.writeFile(p.project, md, "utf8");
  return project;
}

async function prompt(): Promise<Partial<Project>> {
  const rl = readline.createInterface({ input, output });
  try {
    const ask = async (q: string, def?: string): Promise<string> => {
      const a = (await rl.question(`${q}${def ? ` [${def}]` : ""}: `)).trim();
      return a || def || "";
    };
    const askList = async (q: string, def: string[]): Promise<string[]> => {
      const a = await ask(q, def.join(","));
      return a
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    };

    const name = await ask("Project name", "my-app");
    const mode = (await ask("Mode (greenfield|brownfield|modernization)", "greenfield")) as Project["mode"];
    const description = await ask("One-line description", "TODO");
    const primaryLanguage = await ask("Primary language", "typescript");
    const runtime = await ask("Runtime", "node20");
    const frameworks = await askList("Frameworks (comma-separated)", ["express"]);
    const dataStores = await askList("Data stores (comma-separated)", []);
    const deploymentTargets = await askList("Deployment targets (comma-separated)", ["docker"]);

    return { name, mode, description, primaryLanguage, runtime, frameworks, dataStores, deploymentTargets };
  } finally {
    rl.close();
  }
}
