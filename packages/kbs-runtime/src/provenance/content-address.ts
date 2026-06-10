// Content-addressed provenance for KBS records.
//
// Wires @maataa/runtime-storage's IPFS content addressing into kbs-runtime so a
// source/citation/claim can carry a GENUINE IPFS CID (CIDv1/raw/sha2-256) as its
// provenance fingerprint — tamper-evident and verifiable, far stronger than the
// legacy 32-bit FNV `stableHash`. Additive: existing bindEvidenceHash is
// untouched; this is an opt-in upgrade.
//
// Honest scope: the CID is a real content address (same bytes → same CID as
// `ipfs add --raw-leaves --cid-version=1`). It is computed locally; nothing is
// published to the public IPFS network.
import { cidOf } from "../../../runtime-storage/src/ipfs.mjs";

/** Deterministic canonical serialization (key-sorted) — stable across runs. */
export function canonicalize(input: unknown): string {
  if (input === null || typeof input !== "object") return JSON.stringify(input) ?? "null";
  if (Array.isArray(input)) return `[${input.map((i) => canonicalize(i)).join(",")}]`;
  const rec = input as Record<string, unknown>;
  return `{${Object.keys(rec).sort().map((k) => `${JSON.stringify(k)}:${canonicalize(rec[k])}`).join(",")}}`;
}

/** Genuine IPFS CID for any payload's canonical form. */
export async function contentCid(payload: unknown): Promise<string> {
  return cidOf(canonicalize(payload));
}

/**
 * Returns a copy of `record` with `hash` set to its content-addressed CID
 * (prefixed `ipfs:` to distinguish from legacy `kbs:` FNV hashes), plus the bare
 * `cid`. By default the whole record (minus any existing hash/cid) is addressed.
 */
export async function bindContentAddress<T extends { id: string; hash?: string }>(
  record: T,
  payload?: unknown,
): Promise<T & { hash: string; cid: string }> {
  const subject = payload ?? stripProvenance(record);
  const cid = await contentCid(subject);
  return { ...record, hash: `ipfs:${cid}`, cid };
}

/** True if a record's hash is a content-addressed CID provenance. */
export function isContentAddressed(record: { hash?: string }): boolean {
  return typeof record.hash === "string" && record.hash.startsWith("ipfs:");
}

function stripProvenance<T extends Record<string, unknown>>(record: T): Omit<T, "hash" | "cid"> {
  const { hash: _h, cid: _c, ...rest } = record as Record<string, unknown>;
  return rest as Omit<T, "hash" | "cid">;
}
