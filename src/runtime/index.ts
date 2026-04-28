/**
 * SpecFleetRuntime — top-level orchestrator. Loads .specfleet/, instantiates the SDK client,
 * and exposes high-level operations (plan / spawn / delegate / review).
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import { CopilotClient } from "@github/copilot-sdk";
import { loadAllCharters, mirrorCharters } from "./charter.js";
import { AuditLog } from "./audit.js";
import { SpecFleetSession } from "./session.js";
import { findSpecFleetRoot, specFleetPaths, ensureDir, readMaybe } from "../util/paths.js";
import { loadCustomPatterns, redact } from "../util/secrets.js";
import {
  loadEgressPolicy,
  loadIpGuardPolicy,
  loadTrustedSigners,
  type CompiledIpGuard,
  type EgressPolicy,
  type TrustedSigners,
} from "../util/policies.js";
import { isOfflineMode } from "./policy.js";
import type { Charter, Decision, Instruction, Project } from "../schema/index.js";
import { InstructionSchema, ProjectSchema } from "../schema/index.js";
import matter from "gray-matter";

export interface DelegateResult {
  child: string;
  output: string;
  redactedSecrets: number;
}

export class SpecFleetRuntime {
  private client: CopilotClient | null = null;
  private charters: Charter[] = [];
  private chartersByName = new Map<string, Charter>();
  readonly paths: ReturnType<typeof specFleetPaths>;
  readonly audit: AuditLog;
  egress: EgressPolicy | null = null;
  ipGuard: CompiledIpGuard | null = null;
  trustedSigners: TrustedSigners | null = null;
  offline = false;

  private constructor(public readonly root: string) {
    this.paths = specFleetPaths(root);
    this.audit = new AuditLog(this.paths.auditDir);
  }

  static async open(start: string = process.cwd()): Promise<SpecFleetRuntime> {
    const root = await findSpecFleetRoot(start);
    const rt = new SpecFleetRuntime(root);
    await rt.load();
    return rt;
  }

  async load(): Promise<void> {
    await this.audit.init();
    await loadCustomPatterns(this.paths.policiesDir);
    this.egress = await loadEgressPolicy(this.paths.policiesDir);
    this.ipGuard = await loadIpGuardPolicy(this.paths.policiesDir);
    this.trustedSigners = await loadTrustedSigners(this.paths.policiesDir);
    this.offline = isOfflineMode();
    this.charters = await loadAllCharters(this.paths.chartersDir);
    this.chartersByName = new Map(this.charters.map((c) => [c.name, c]));
    // Mirror charters to .github/agents for graceful degradation.
    await mirrorCharters(this.charters, this.paths.githubAgentsDir);
  }

  async readInstruction(): Promise<Instruction | null> {
    const raw = await readMaybe(this.paths.instruction);
    if (!raw) return null;
    const fm = matter(raw);
    return InstructionSchema.parse(fm.data);
  }

  async readProject(): Promise<Project | null> {
    const raw = await readMaybe(this.paths.project);
    if (!raw) return null;
    const fm = matter(raw);
    return ProjectSchema.parse(fm.data);
  }

  charter(name: string): Charter {
    const c = this.chartersByName.get(name);
    if (!c) throw new Error(`Unknown charter: ${name}`);
    return c;
  }

  listCharters(): Charter[] {
    return [...this.charters];
  }

  rootCharter(): Charter {
    const r = this.charters.find((c) => c.tier === "root");
    if (!r) throw new Error("No root charter");
    return r;
  }

  async ensureClient(): Promise<CopilotClient> {
    if (this.client) return this.client;
    this.client = new CopilotClient();
    await this.client.start();
    return this.client;
  }

  async spawn(charterName: string): Promise<SpecFleetSession> {
    const charter = this.charter(charterName);
    const client = await this.ensureClient();
    const immutablePaths = [this.paths.instruction];
    return SpecFleetSession.create(client, {
      charter,
      workingDirectory: this.root,
      audit: this.audit,
      immutablePaths,
      egress: this.egress,
      ipGuard: this.ipGuard,
      offline: this.offline,
    });
  }

  /**
   * Delegate a brief from one charter to another. The child runs in an *isolated*
   * SDK session so its context window does not pollute the parent. Output is
   * scrubbed for secrets before returning to the parent.
   */
  async delegate(parent: string, child: string, brief: string): Promise<DelegateResult> {
    if (!this.chartersByName.has(child)) {
      throw new Error(`Cannot delegate: child charter "${child}" not found`);
    }
    const session = await this.spawn(child);
    try {
      const raw = await session.ask(buildDelegationBrief(parent, brief));
      const { redacted, matches } = redact(raw);
      return { child, output: redacted, redactedSecrets: matches.length };
    } finally {
      await session.dispose();
    }
  }

  async appendDecision(d: Decision): Promise<void> {
    const line = `\n## ${d.timestamp} · ${d.agent} · ${d.kind} · ${d.title}\n\n${d.body}\n${
      d.refs.length ? `\nrefs: ${d.refs.join(", ")}\n` : ""
    }`;
    await ensureDir(path.dirname(this.paths.decisions));
    await fs.appendFile(this.paths.decisions, line, "utf8");
  }

  async dispose(): Promise<void> {
    if (this.client) {
      await this.client.stop();
      this.client = null;
    }
    await this.audit.close();
  }
}

function buildDelegationBrief(parent: string, brief: string): string {
  return [
    `<delegation from="${parent}">`,
    `You are receiving an isolated brief from your parent agent. Treat this as your sole task; do not fetch unrelated context.`,
    ``,
    `<brief>`,
    brief,
    `</brief>`,
    ``,
    `Return a concise structured response:`,
    `1) Summary of what you did (1-3 sentences)`,
    `2) Files created/modified (paths only)`,
    `3) Outstanding questions or follow-ups (bullet list, or "none")`,
    `</delegation>`,
  ].join("\n");
}
