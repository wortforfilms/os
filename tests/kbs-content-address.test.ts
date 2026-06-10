// Proves runtime-storage is wired into kbs-runtime: KBS records now carry a
// GENUINE IPFS CID as provenance. Real integration — no mocks.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bindContentAddress,
  contentCid,
  canonicalize,
  isContentAddressed,
} from "../packages/kbs-runtime/src/provenance/content-address.ts";
import { cidOf } from "../packages/runtime-storage/src/ipfs.mjs";
import type { KbsSource } from "../packages/kbs-runtime/src/types.ts";

const source: KbsSource = {
  id: "src-1",
  title: "Rigveda manuscript",
  type: "MANUSCRIPT",
  trustLevel: "HIGH",
  status: "VERIFIED",
};

test("KBS source gets a real IPFS CID provenance via runtime-storage", async () => {
  const bound = await bindContentAddress(source);
  assert.ok(bound.cid.startsWith("bafkrei")); // CIDv1 / raw / base32
  assert.equal(bound.hash, `ipfs:${bound.cid}`);
  assert.equal(isContentAddressed(bound), true);
  // CID equals the storage runtime's own computation over the canonical form
  assert.equal(bound.cid, await cidOf(canonicalize({ id: source.id, title: source.title, type: source.type, trustLevel: source.trustLevel, status: source.status })));
});

test("content addressing is deterministic and content-sensitive", async () => {
  const a = await contentCid({ x: 1, y: 2 });
  const b = await contentCid({ y: 2, x: 1 }); // key order independent
  const c = await contentCid({ x: 1, y: 3 }); // different content
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("matches the canonical public IPFS vector (spec-correct)", async () => {
  assert.equal(await cidOf("hello world"), "bafkreifzjut3te2nhyekklss27nh3k72ysco7y32koao5eei66wof36n5e");
});
