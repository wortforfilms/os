/*
 * @maataa/runtime-storage — IPFS-spec content addressing (standalone module).
 *
 * Imports ONLY `multiformats` so consumers can adopt content addressing without
 * pulling in the SQL engines (node:sqlite / @libsql/client). Produces GENUINE
 * IPFS CIDs (CIDv1 / raw / sha2-256) — verified against the public canonical
 * vector in tests. LOCAL-FIRST: a content-addressed store, not a node on the
 * public IPFS network (no DHT/bitswap/pinning).
 */
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import * as raw from "multiformats/codecs/raw";

const toBytes = (input) => (input instanceof Uint8Array ? input : new TextEncoder().encode(String(input)));

/** Compute the genuine IPFS CID for bytes/string without storing. */
export async function cidOf(input) {
  const u8 = toBytes(input);
  const digest = await sha256.digest(raw.encode(u8));
  return CID.create(1, raw.code, digest).toString();
}

/** Content-addressed store over a local blockstore (Map by default). */
export class IpfsBlockStore {
  constructor(blockstore = new Map()) {
    this.kind = "ipfs";
    this.blocks = blockstore; // Map<cidString, Uint8Array>
  }
  static async cidOf(input) { return cidOf(input); }
  async put(input) {
    const u8 = toBytes(input);
    const cid = await cidOf(u8);
    this.blocks.set(cid, u8);
    return cid;
  }
  async get(cid) { return this.blocks.get(String(cid)) ?? null; }
  async has(cid) { return this.blocks.has(String(cid)); }
  health() {
    return { kind: this.kind, status: "active", blocks: this.blocks.size, network: false, scope: "local-blockstore (no DHT/bitswap/pinning)" };
  }
}
