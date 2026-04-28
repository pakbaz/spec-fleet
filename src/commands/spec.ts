/**
 * `eas spec new <name>` and `eas spec list` — Spec-Kit / GSD-style spec
 * authoring. Specs live under .eas/specs/<slug>.spec.md and are seeded from
 * templates/spec.md. `eas plan --from-spec <id>` (wired in cli.ts) reads a
 * spec into the planner prompt.
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import fg from "fast-glob";
import matter from "gray-matter";
import { findEasRoot, ensureDir, writeFileAtomic, readMaybe } from "../util/paths.js";

const __filename = fileURLToPath(import.meta.url);
// dist/commands/spec.js → ../../templates/spec.md
const SPEC_TEMPLATE = path.resolve(path.dirname(__filename), "..", "..", "templates", "spec.md");

export interface SpecOptions {
  name?: string;
}

export async function specCommand(action: "new" | "list", opts: SpecOptions): Promise<void> {
  const root = await findEasRoot();
  const specsDir = path.join(root, ".eas", "specs");
  await ensureDir(specsDir);

  if (action === "new") {
    const name = opts.name;
    if (!name) throw new Error("spec name required (e.g. eas spec new payment-flow)");
    const slug = slugify(name);
    if (!slug) throw new Error(`Invalid spec name: ${name}`);
    const file = path.join(specsDir, `${slug}.spec.md`);
    try {
      await fs.stat(file);
      throw new Error(`spec already exists: ${file}`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    const tpl = await readMaybe(SPEC_TEMPLATE);
    if (!tpl) throw new Error(`spec template missing: ${SPEC_TEMPLATE}`);
    const today = new Date().toISOString().slice(0, 10);
    const body = tpl
      .replace(/__ID__/g, slug)
      .replace(/__TITLE__/g, name)
      .replace(/__CREATED__/g, today);
    await writeFileAtomic(file, body);
    console.log(chalk.green(`✓ Created ${path.relative(process.cwd(), file)}`));
    return;
  }

  if (action === "list") {
    const files = await fg("*.spec.md", { cwd: specsDir, absolute: true });
    if (files.length === 0) {
      console.log(chalk.gray("(no specs)"));
      return;
    }
    files.sort();
    for (const f of files) {
      const raw = await fs.readFile(f, "utf8");
      const fm = matter(raw);
      const data = fm.data as { id?: string; title?: string; status?: string };
      console.log(
        `${chalk.cyan((data.id ?? path.basename(f, ".spec.md")).padEnd(28))} ` +
          `${(data.status ?? "draft").padEnd(10)} ${data.title ?? ""}`,
      );
    }
    return;
  }
}

/**
 * Read a spec by id and return its raw markdown (frontmatter + body).
 * Used by `eas plan --from-spec`.
 */
export async function readSpec(specId: string): Promise<string> {
  const root = await findEasRoot();
  const file = path.join(root, ".eas", "specs", `${slugify(specId)}.spec.md`);
  const raw = await readMaybe(file);
  if (!raw) throw new Error(`spec not found: ${specId} (looked at ${file})`);
  return raw;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
