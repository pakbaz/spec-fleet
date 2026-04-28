/**
 * `specfleet onboard` — Brownfield mode. For MVP this is a heuristic analyzer that
 * infers stack from package.json / pyproject.toml / pom.xml / go.mod and emits
 * a draft .specfleet/project.md. A real Phase-2 implementation will spawn the
 * Architect agent with a codebase-walking subagent and build a RAG index.
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import chalk from "chalk";
import matter from "gray-matter";
import { ensureDir, specFleetPaths, readMaybe } from "../util/paths.js";
import { ProjectSchema, type Project } from "../schema/index.js";
import { mirrorCharters, loadAllCharters } from "../runtime/charter.js";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const TEMPLATES_DIR = path.resolve(path.dirname(__filename), "..", "..", "templates");

interface OnboardOptions {
  dir?: string;
}

export async function onboardCommand(opts: OnboardOptions): Promise<void> {
  const root = path.resolve(opts.dir ?? process.cwd());
  const p = specFleetPaths(root);
  console.log(chalk.cyan(`▸ Onboarding ${root} (brownfield)`));

  await ensureDir(p.specFleetDir);
  // Copy templates non-destructively (so we get charters + policies + skills).
  await copyDirRecursive(TEMPLATES_DIR, p.specFleetDir);
  for (const d of [p.auditDir, p.checkpointsDir, p.indexDir, p.plansDir]) {
    await ensureDir(d);
  }

  const inferred = await detect(root);
  const project = ProjectSchema.parse({
    name: path.basename(root),
    mode: "brownfield",
    description: `Brownfield project. Detected: ${inferred.primaryLanguage}/${inferred.runtime}.`,
    ...inferred,
  });

  const md = matter.stringify(
    `# ${project.name}\n\nAuto-drafted from repo inspection. Edit as needed.\n`,
    project as unknown as Record<string, unknown>,
  );
  await fs.writeFile(p.project, md, "utf8");

  const charters = await loadAllCharters(p.chartersDir);
  await mirrorCharters(charters, p.githubAgentsDir);

  console.log(chalk.green(`✓ Drafted ${path.relative(root, p.project)} (${project.primaryLanguage}/${project.runtime})`));
  console.log(chalk.gray(`  Next: review .specfleet/project.md, then run \`specfleet review\` for compliance audit.`));
}

async function detect(root: string): Promise<Partial<Project>> {
  const out: Partial<Project> = {
    primaryLanguage: "unknown",
    runtime: "unknown",
    frameworks: [],
    deploymentTargets: [],
  };
  const pkg = await readMaybe(path.join(root, "package.json"));
  if (pkg) {
    try {
      const j = JSON.parse(pkg) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
      out.primaryLanguage = "typescript";
      out.runtime = "node20";
      const deps = { ...(j.dependencies ?? {}), ...(j.devDependencies ?? {}) };
      const fr: string[] = [];
      for (const k of Object.keys(deps)) {
        if (["express", "fastify", "next", "react", "vue", "nestjs", "@nestjs/core"].includes(k)) fr.push(k);
      }
      out.frameworks = fr;
    } catch {
      /* ignore */
    }
  } else if (await readMaybe(path.join(root, "pyproject.toml"))) {
    out.primaryLanguage = "python";
    out.runtime = "python3";
  } else if (await readMaybe(path.join(root, "go.mod"))) {
    out.primaryLanguage = "go";
    out.runtime = "go";
  } else if (await readMaybe(path.join(root, "pom.xml"))) {
    out.primaryLanguage = "java";
    out.runtime = "jvm";
  } else if (await readMaybe(path.join(root, "Cargo.toml"))) {
    out.primaryLanguage = "rust";
    out.runtime = "cargo";
  }
  if (await readMaybe(path.join(root, "Dockerfile"))) {
    out.deploymentTargets = ["docker"];
  }
  return out;
}

async function copyDirRecursive(src: string, dst: string): Promise<void> {
  await ensureDir(dst);
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) await copyDirRecursive(s, d);
    else {
      try {
        await fs.stat(d);
      } catch {
        await fs.copyFile(s, d);
      }
    }
  }
}
