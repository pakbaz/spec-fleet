/**
 * Policy loaders for `.specfleet/policies/*.json`.
 *
 * Each policy is optional; a missing file is treated as "no enforcement"
 * unless the surrounding feature defines a stricter default (see notes).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

// ---------------- Egress allowlist ----------------

export const EgressPolicySchema = z.object({
  allow: z.array(z.string()).default([]),
  deny: z.array(z.string()).optional(),
});
export type EgressPolicy = z.infer<typeof EgressPolicySchema>;

// ---------------- IP guard ----------------

export const IpGuardPatternSchema = z.object({
  name: z.string().min(1),
  regex: z.string().min(1),
  flags: z.string().optional(),
});

export const IpGuardPolicySchema = z.object({
  patterns: z.array(IpGuardPatternSchema).default([]),
  mode: z.enum(["redact", "block"]).default("block"),
});
export type IpGuardPolicy = z.infer<typeof IpGuardPolicySchema>;

export interface CompiledIpGuard {
  mode: "redact" | "block";
  patterns: Array<{ name: string; re: RegExp }>;
}

// ---------------- Trusted signers ----------------

export const TrustedSignersSchema = z.object({
  keys: z
    .array(
      z.object({
        id: z.string().min(1),
        pubkey: z.string().min(1),
        alg: z.string().min(1),
      }),
    )
    .default([]),
});
export type TrustedSigners = z.infer<typeof TrustedSignersSchema>;

// ---------------- Loaders ----------------

async function readJsonIfExists(file: string): Promise<unknown | null> {
  try {
    const raw = await fs.readFile(file, "utf8");
    // Strip "//"-style comments-as-keys: any top-level key starting with "//" is dropped after parse.
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const k of Object.keys(parsed)) {
        if (k.startsWith("//") || k.startsWith("#")) delete parsed[k];
      }
    }
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function loadEgressPolicy(policiesDir: string): Promise<EgressPolicy | null> {
  const data = await readJsonIfExists(path.join(policiesDir, "egress.json"));
  if (data === null) return null;
  return EgressPolicySchema.parse(data);
}

export async function loadIpGuardPolicy(policiesDir: string): Promise<CompiledIpGuard | null> {
  const data = await readJsonIfExists(path.join(policiesDir, "ip-guard.json"));
  if (data === null) return null;
  const policy = IpGuardPolicySchema.parse(data);
  return {
    mode: policy.mode,
    patterns: policy.patterns.map((p) => ({
      name: p.name,
      re: new RegExp(p.regex, p.flags ?? "g"),
    })),
  };
}

export async function loadTrustedSigners(policiesDir: string): Promise<TrustedSigners | null> {
  const data = await readJsonIfExists(path.join(policiesDir, "trusted-signers.json"));
  if (data === null) return null;
  return TrustedSignersSchema.parse(data);
}

// ---------------- Egress matching ----------------

/**
 * Match a host (optionally with `:port`) against a pattern. Patterns can be:
 *   - exact host: "example.com"
 *   - host:port:  "example.com:443"
 *   - subdomain wildcard: "*.example.com" (matches a.example.com, b.a.example.com)
 * All comparisons are case-insensitive.
 */
export function hostMatches(host: string, pattern: string): boolean {
  const h = host.toLowerCase();
  const p = pattern.toLowerCase();
  if (p.startsWith("*.")) {
    const tail = p.slice(2);
    const hostNoPort = h.split(":")[0];
    return hostNoPort === tail || hostNoPort.endsWith("." + tail);
  }
  if (p.includes(":")) return h === p;
  // Pattern has no port: match host part only.
  return h.split(":")[0] === p;
}

export function isHostAllowed(host: string, policy: EgressPolicy): boolean {
  if (policy.deny?.some((d) => hostMatches(host, d))) return false;
  // Empty allow list means deny-all (per spec).
  return policy.allow.some((a) => hostMatches(host, a));
}

const URL_RE = /\bhttps?:\/\/([^\s/'"`<>)]+)/gi;

export function extractHosts(text: string): string[] {
  const out: string[] = [];
  URL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = URL_RE.exec(text)) !== null) out.push(m[1]);
  return out;
}

// ---------------- IP-guard application ----------------

export interface IpGuardMatch {
  name: string;
  index: number;
  length: number;
}

export function findIpGuardMatches(text: string, guard: CompiledIpGuard): IpGuardMatch[] {
  const out: IpGuardMatch[] = [];
  for (const { name, re } of guard.patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    // If pattern has /g, exec advances; otherwise, exec only finds first.
    if (re.global) {
      while ((m = re.exec(text)) !== null) {
        out.push({ name, index: m.index, length: m[0].length });
        if (m[0].length === 0) re.lastIndex++; // guard against zero-width loops
      }
    } else {
      m = re.exec(text);
      if (m) out.push({ name, index: m.index, length: m[0].length });
    }
  }
  return out;
}

export function applyIpGuardRedaction(text: string, guard: CompiledIpGuard): {
  redacted: string;
  matches: IpGuardMatch[];
} {
  const matches = findIpGuardMatches(text, guard);
  if (matches.length === 0) return { redacted: text, matches };
  const sorted = [...matches].sort((a, b) => b.index - a.index);
  let out = text;
  for (const m of sorted) {
    out = out.slice(0, m.index) + `[REDACTED:${m.name}]` + out.slice(m.index + m.length);
  }
  return { redacted: out, matches };
}
