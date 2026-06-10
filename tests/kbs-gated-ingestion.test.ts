// Proves the entitlement boundary is enforced IN-FLOW on the KBS ingestion path:
// ingestion meters bytes via consume(), accepts within quota (with real CID
// provenance), and rejects over quota fail-closed. Real integration, no mocks.
import assert from "node:assert/strict";
import { test } from "node:test";
import { GatedIngestion } from "../packages/kbs-runtime/src/ingestion/gated.ts";
import { EntitlementRuntime } from "../packages/runtime-entitlements/src/index.ts";
import type { KbsSource } from "../packages/kbs-runtime/src/types.ts";

const src = (id: string): Omit<KbsSource, "hash"> => ({
  id,
  title: `Source ${id}`,
  type: "MANUSCRIPT",
  trustLevel: "HIGH",
  status: "VERIFIED",
});

test("within quota: source accepted, usage metered, CID provenance attached", async () => {
  const e = new EntitlementRuntime();
  e.setSku("acct", "starter"); // storage cap 5GB
  const gate = new GatedIngestion(e, "acct");
  const r = await gate.ingestSource(src("s1"));
  assert.equal(r.accepted, true);
  assert.ok(r.bytes > 0);
  assert.match(r.record!.hash, /^ipfs:bafkrei/); // real content-addressed provenance
  assert.equal(e.getUsage("acct").storageBytes, r.bytes); // metered against cap
});

test("over quota: ingestion REJECTED fail-closed, usage not incremented", async () => {
  const e = new EntitlementRuntime();
  e.setSku("acct", "starter");
  const cap = e.meter("acct").caps.storageBytes;
  // Fill storage to 50 bytes below the cap, then ingest a record bigger than that.
  e.consume("acct", "storageBytes", cap - 50);
  const before = e.getUsage("acct").storageBytes;
  const gate = new GatedIngestion(e, "acct");
  const r = await gate.ingestSource(src("too-big-source-record-well-over-fifty-bytes"));
  assert.equal(r.accepted, false);
  assert.match(r.reason, /exceed storageBytes cap/);
  assert.equal(r.record, undefined); // nothing ingested
  assert.equal(e.getUsage("acct").storageBytes, before); // fail-closed: no mutation
});

test("unknown account is denied at the gate (no default-allow)", async () => {
  const e = new EntitlementRuntime();
  const gate = new GatedIngestion(e, "ghost"); // never assigned a SKU
  const r = await gate.ingestSource(src("x"));
  assert.equal(r.accepted, false);
  assert.match(r.reason, /no entitlement/);
});

test("sequential ingests accumulate usage deterministically", async () => {
  const e = new EntitlementRuntime();
  e.setSku("acct", "team");
  const gate = new GatedIngestion(e, "acct");
  const a = await gate.ingestSource(src("a"));
  const b = await gate.ingestSource(src("b"));
  assert.equal(e.getUsage("acct").storageBytes, a.bytes + b.bytes);
});
