/**
 * Secret detection. Defense-in-depth on tool inputs/outputs. Patterns kept in one
 * place so they are auditable and can be extended via .eas/policies/secrets.json.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

export interface SecretMatch {
  rule: string;
  index: number;
  preview: string;
}

const BUILTIN_PATTERNS: Array<{ rule: string; re: RegExp }> = [
  { rule: "github_pat", re: /\bghp_[A-Za-z0-9]{36}\b/g },
  { rule: "github_pat_v2", re: /\bgithub_pat_[A-Za-z0-9_]{82}\b/g },
  { rule: "aws_access_key", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { rule: "aws_secret", re: /\b(?:[A-Za-z0-9/+=]{40})\b(?=.*aws)/gi },
  { rule: "azure_storage_key", re: /\b[A-Za-z0-9+/]{86}==\b/g },
  { rule: "openai_key", re: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { rule: "slack_token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g },
  { rule: "private_key", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g },
  { rule: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
];

let extraPatterns: Array<{ rule: string; re: RegExp }> | null = null;

export async function loadCustomPatterns(policiesDir: string): Promise<void> {
  if (extraPatterns) return;
  const file = path.join(policiesDir, "secrets.json");
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as Array<{ rule: string; pattern: string; flags?: string }>;
    extraPatterns = parsed.map((p) => ({ rule: p.rule, re: new RegExp(p.pattern, p.flags ?? "g") }));
  } catch {
    extraPatterns = [];
  }
}

export function findSecrets(text: string): SecretMatch[] {
  if (!text) return [];
  const matches: SecretMatch[] = [];
  const all = [...BUILTIN_PATTERNS, ...(extraPatterns ?? [])];
  for (const { rule, re } of all) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      matches.push({
        rule,
        index: m.index,
        preview: m[0].slice(0, 4) + "…" + m[0].slice(-2),
      });
    }
  }
  return matches;
}

export function redact(text: string): { redacted: string; matches: SecretMatch[] } {
  const matches = findSecrets(text);
  if (matches.length === 0) return { redacted: text, matches };
  let out = text;
  // Sort descending so substitutions don't shift earlier indices.
  const sorted = [...matches].sort((a, b) => b.index - a.index);
  for (const m of sorted) {
    out = out.slice(0, m.index) + `[REDACTED:${m.rule}]` + out.slice(m.index + m.preview.length + 1);
  }
  return { redacted: out, matches };
}
