import { test } from "node:test";
import assert from "node:assert/strict";
import * as fed from "../packages/runtime-federation/src/index.ts";
import * as kg from "../packages/runtime-knowledge-graph/src/index.ts";
import * as validation from "../packages/runtime-validation/src/index.ts";
import * as registry from "../packages/runtime-hkd-registry/src/index.ts";
import * as governance from "../packages/runtime-governance/src/index.ts";
import * as observability from "../packages/runtime-observability/src/index.ts";

test("traceClaimLineage emits a real cross-runtime lineage chain", async () => {
  kg.reset(); validation.reset(); observability.reset();
  const t = await kg.defineEntityType({ name: "C", schema: { x: "string" } });
  const r = await fed.traceClaimLineage(t.data.typeId, { x: "a" },
    [{ ref: { runtime: "runtime-hkd-registry", id: "e1" }, weight: 3 }],
    { approach: "experiment", preregistered: false, notes: "" });
  assert.ok(r.isOk, JSON.stringify(r.error));
  assert.equal(r.data.hops, 3); // kg + validation + 1 evidence
});

test("verifyGovernanceAuditChain confirms hash-chain integrity", () => {
  governance.reset();
  governance.definePolicy({ name: "p", key: "x", op: "eq", value: 1 });
  governance.enforce({ x: 1 }); governance.enforce({ x: 2 });
  const r = fed.verifyGovernanceAuditChain();
  assert.ok(r.isOk);
  assert.equal(r.data.records, 2);
  assert.equal(r.data.intact, true);
});

test("verifyRegistryLedgerChain confirms ledger integrity", async () => {
  registry.reset();
  await registry.register({ name: "a", kind: "evidence", version: "1", payloadHash: "h1", registrant: "op" });
  await registry.register({ name: "b", kind: "evidence", version: "1", payloadHash: "h2", registrant: "op" });
  const r = await fed.verifyRegistryLedgerChain();
  assert.ok(r.isOk);
  assert.equal(r.data.artifacts, 2);
  assert.equal(r.data.intact, true);
});

test("detectDegraded reports all runtimes ready", () => {
  const r = fed.detectDegraded();
  assert.ok(r.isOk);
  assert.equal(r.data.ready, true);
  assert.deepEqual(r.data.degraded, []);
});

test("twoHopNeighbours traverses two edges in the KG", async () => {
  kg.reset();
  const t = await kg.defineEntityType({ name: "N", schema: {} });
  const a = await kg.addEntity(t.data.typeId, {});
  const b = await kg.addEntity(t.data.typeId, {});
  const c = await kg.addEntity(t.data.typeId, {});
  await kg.addRelation(a.data.id, "LINK", b.data.id);
  await kg.addRelation(b.data.id, "LINK", c.data.id);
  const r = await fed.twoHopNeighbours(a.data.id);
  assert.ok(r.isOk);
  assert.deepEqual(r.data.direct, [b.data.id]);
  assert.deepEqual(r.data.twoHop, [c.data.id]);
});

test("federationReport composes health + chain integrity", async () => {
  governance.reset(); registry.reset();
  const r = await fed.federationReport();
  assert.ok(r.isOk);
  assert.equal(r.data.runtimes, 5);
  assert.equal(r.data.allReady, true);
  assert.equal(r.data.auditIntact, true);
  assert.equal(r.data.ledgerIntact, true);
});
