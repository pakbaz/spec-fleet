import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  applyIpGuardRedaction,
  extractHosts,
  hostMatches,
  isHostAllowed,
  loadEgressPolicy,
  loadIpGuardPolicy,
  loadTrustedSigners,
} from "../../src/util/policies.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "eas-policies-"));
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("hostMatches / isHostAllowed", () => {
  it("matches exact hosts", () => {
    expect(hostMatches("api.github.com", "api.github.com")).toBe(true);
    expect(hostMatches("evil.com", "api.github.com")).toBe(false);
  });
  it("matches wildcards", () => {
    expect(hostMatches("foo.github.com", "*.github.com")).toBe(true);
    expect(hostMatches("a.b.github.com", "*.github.com")).toBe(true);
    expect(hostMatches("github.com", "*.github.com")).toBe(true);
    expect(hostMatches("evilgithub.com", "*.github.com")).toBe(false);
  });
  it("ignores port when pattern has none", () => {
    expect(hostMatches("api.github.com:443", "api.github.com")).toBe(true);
  });
  it("requires port match when pattern has one", () => {
    expect(hostMatches("api.github.com:443", "api.github.com:443")).toBe(true);
    expect(hostMatches("api.github.com:80", "api.github.com:443")).toBe(false);
  });
  it("deny overrides allow", () => {
    const policy = { allow: ["*.example.com"], deny: ["evil.example.com"] };
    expect(isHostAllowed("foo.example.com", policy)).toBe(true);
    expect(isHostAllowed("evil.example.com", policy)).toBe(false);
  });
  it("empty allow = deny-all", () => {
    expect(isHostAllowed("anything.com", { allow: [] })).toBe(false);
  });
});

describe("extractHosts", () => {
  it("pulls https/http hosts out of a string", () => {
    const t = "Fetch https://api.github.com/foo and http://evil.com/bar then https://x.y.z:8080/path";
    expect(extractHosts(t)).toEqual(["api.github.com", "evil.com", "x.y.z:8080"]);
  });
  it("returns empty when no URL", () => {
    expect(extractHosts("hello")).toEqual([]);
  });
});

describe("loadEgressPolicy", () => {
  it("returns null when file is absent", async () => {
    expect(await loadEgressPolicy(tmp)).toBeNull();
  });
  it("loads and validates", async () => {
    await fs.writeFile(
      path.join(tmp, "egress.json"),
      JSON.stringify({ "//": "comment", allow: ["api.github.com"], deny: ["bad.example.com"] }),
    );
    const p = await loadEgressPolicy(tmp);
    expect(p).not.toBeNull();
    expect(p!.allow).toEqual(["api.github.com"]);
    expect(p!.deny).toEqual(["bad.example.com"]);
  });
  it("throws on bad shape", async () => {
    await fs.writeFile(path.join(tmp, "egress.json"), JSON.stringify({ allow: "not-an-array" }));
    await expect(loadEgressPolicy(tmp)).rejects.toThrow();
  });
});

describe("loadIpGuardPolicy + redaction", () => {
  it("returns null when file is absent", async () => {
    expect(await loadIpGuardPolicy(tmp)).toBeNull();
  });
  it("compiles patterns", async () => {
    await fs.writeFile(
      path.join(tmp, "ip-guard.json"),
      JSON.stringify({
        mode: "redact",
        patterns: [{ name: "codename", regex: "Project Atlas", flags: "g" }],
      }),
    );
    const p = await loadIpGuardPolicy(tmp);
    expect(p).not.toBeNull();
    expect(p!.mode).toBe("redact");
    const r = applyIpGuardRedaction("This is Project Atlas, also Project Atlas again.", p!);
    expect(r.matches.length).toBe(2);
    expect(r.redacted).toBe("This is [REDACTED:codename], also [REDACTED:codename] again.");
  });
  it("defaults mode to block", async () => {
    await fs.writeFile(
      path.join(tmp, "ip-guard.json"),
      JSON.stringify({ patterns: [{ name: "x", regex: "secret-thing" }] }),
    );
    const p = await loadIpGuardPolicy(tmp);
    expect(p!.mode).toBe("block");
  });
});

describe("loadTrustedSigners", () => {
  it("loads keys", async () => {
    await fs.writeFile(
      path.join(tmp, "trusted-signers.json"),
      JSON.stringify({ keys: [{ id: "a", pubkey: "b", alg: "ed25519" }] }),
    );
    const t = await loadTrustedSigners(tmp);
    expect(t!.keys[0].id).toBe("a");
  });
});
