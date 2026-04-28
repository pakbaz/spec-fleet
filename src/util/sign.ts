/**
 * Charter signature verification (v0.2 = schema + verifier hook only).
 *
 * Full sigstore wiring lands in v0.4. For now:
 *   - charters MAY carry `signature` and `signed_by` frontmatter fields
 *   - if neither is present, callers treat the charter as "not signed"
 *   - if a signature is present, this verifier returns `not-implemented`
 *     unless a future override is provided.
 */
import type { Charter } from "../schema/index.js";
import type { TrustedSigners } from "./policies.js";

export type SignatureCheck =
  | { ok: true; reason: "no-signature" | "verified"; signer?: string }
  | { ok: false; reason: "not-implemented" | "no-trusted-signers" | "untrusted-signer" | "bad-signature"; signer?: string };

export function hasSignature(charter: Charter): boolean {
  return typeof charter.signature === "string" && charter.signature.length > 0;
}

export function verifyCharterSignature(
  charter: Charter,
  trusted: TrustedSigners | null,
): SignatureCheck {
  if (!hasSignature(charter)) return { ok: true, reason: "no-signature" };
  if (!trusted || trusted.keys.length === 0) {
    return { ok: false, reason: "no-trusted-signers", signer: charter.signed_by };
  }
  // v0.4 will perform real cryptographic verification here. For v0.2 we ship
  // the schema + verifier hook only so consumers can wire trust without a
  // breaking change later.
  return { ok: false, reason: "not-implemented", signer: charter.signed_by };
}
