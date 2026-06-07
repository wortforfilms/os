import { test } from "node:test";
import assert from "node:assert/strict";
import * as fed from "../packages/runtime-federation/src/index.ts";
import * as kg from "../packages/runtime-knowledge-graph/src/index.ts";
import * as validation from "../packages/runtime-validation/src/index.ts";
import * as observability from "../packages/runtime-observability/src/index.ts";

const claimRef = { runtime: "runtime-knowledge-graph", entityId: "ent-1" } as const;
const method = { approach: "observation", preregistered: false, notes: "" } as const;

test("shortestPath finds a real BFS path across KG edges", async () => {
  kg.reset();
  const t = await kg.defineEntityType({ name: "N", schema: {} });
  const a = await kg.addEntity(t.data.typeId, {});
  const b = await kg.addEntity(t.data.typeId, {});
  const c = await kg.addEntity(t.data.typeId, {});
  const d = await kg.addEntity(t.data.typeId, {});
  await kg.addRelation(a.data.id, "L", b.data.id);
  await kg.addRelation(b.data.id, "L", c.data.id);
  await kg.addRelation(c.data.id, "L", d.data.id);
  const r = await fed.shortestPath(a.data.id, d.data.id);
  assert.ok(r.isOk);
  assert.equal(r.data.hops, 3);
  const none = await fed.shortestPath(d.data.id, a.data.id); // directed → no reverse path
  assert.equal(none.data, null);
});

test("consensus aggregates confidence across validations (replication-weighted)", async () => {
  validation.reset();
  const s1 = await validation.submitClaim(claimRef, [{ ref: { runtime: "runtime-hkd-registry", id: "e" }, weight: 9 }], method);
  const s2 = await validation.submitClaim(claimRef, [{ ref: { runtime: "runtime-hkd-registry", id: "e" }, weight: 9 }], method);
  const r = await fed.consensus([s1.data.validationId, s2.data.validationId]);
  assert.ok(r.isOk);
  assert.equal(r.data.n, 2);
  assert.ok(r.data.meanConfidence > 0.8);
  assert.equal(r.data.agreement, 1);
  assert.equal((await fed.consensus(["val-nope"])).isOk, false);
});

test("sealEvidenceBundle seals and detects tampering", async () => {
  const s = await fed.sealEvidenceBundle();
  assert.ok(s.isOk);
  assert.equal(fed.verifyBundleSeal(s.data.bundle, s.data.seal).data.intact, true);
  const tampered = { ...s.data.bundle, runtimes: 999 };
  assert.equal(fed.verifyBundleSeal(tampered, s.data.seal).data.intact, false);
});

test("lineageCriticalPath returns ordered hops with total duration", () => {
  observability.reset();
  observability.emit("ev", "runtime-mission", "a");
  observability.emit("ev", "runtime-knowledge-graph", "b");
  const r = fed.lineageCriticalPath("ev");
  assert.ok(r.isOk);
  assert.equal(r.data.hops, 2);
  assert.deepEqual(r.data.order, ["runtime-mission", "runtime-knowledge-graph"]);
  assert.equal(fed.lineageCriticalPath("none").isOk, false);
});

test("federationReadiness is fail-closed: needs all-ready AND policies pass", () => {
  const blocked = fed.federationReadiness({ hardwareAttested: false, quorum: 1, signerVerified: false });
  assert.ok(blocked.isOk);
  assert.equal(blocked.data.decision, "block");
  assert.equal(blocked.data.ready, false);
  const ok2 = fed.federationReadiness({ hardwareAttested: true, quorum: 2, signerVerified: true });
  assert.equal(ok2.data.decision, "allow");
  assert.equal(ok2.data.ready, true); // runtimes all ready in-memory
});
