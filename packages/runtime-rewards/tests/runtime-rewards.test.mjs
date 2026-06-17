import test from "node:test";
import assert from "node:assert/strict";
import rewards, {
  mintPermanentId,
  recordReward,
  buildLedger,
  validateLedger,
  health,
} from "../src/index.ts";

const artifact = { path: "data/x.json", sha256: "a".repeat(64) };
const ev = [{ artifact: "data/x.json", sha256: "a".repeat(64), verified: true }];

test("permanent id is content-addressed and deterministic", () => {
  const a = mintPermanentId("agent1", "task1", [artifact]);
  const b = mintPermanentId("agent1", "task1", [artifact]);
  assert.equal(a.isOk, true);
  assert.equal(a.data, b.data);
  assert.match(a.data, /^agent:agent1:[0-9a-f]{12}$/);
});

test("id changes when the verified artifact changes", () => {
  const a = mintPermanentId("agent1", "task1", [artifact]);
  const c = mintPermanentId("agent1", "task1", [{ path: "data/x.json", sha256: "b".repeat(64) }]);
  assert.notEqual(a.data, c.data);
});

test("minting without artifacts fails closed", () => {
  const r = mintPermanentId("agent1", "task1", []);
  assert.equal(r.isOk, false);
  assert.equal(r.error.code, "E_ID_NO_ARTIFACTS");
});

test("a badge with no evidence is rejected (fail closed)", () => {
  const r = recordReward(
    { role: "agent1", task: "task1", taskTitle: "t", artifacts: [artifact], badges: [{ id: "b", label: "B", tier: "standard", evidence: [] }], nextTasks: [], retired: false },
    null,
  );
  assert.equal(r.isOk, false);
  assert.equal(r.error.code, "E_BADGE_NO_EVIDENCE");
});

test("a badge with unverified evidence is rejected", () => {
  const r = recordReward(
    { role: "agent1", task: "task1", taskTitle: "t", artifacts: [artifact], badges: [{ id: "b", label: "B", tier: "standard", evidence: [{ artifact: "x", sha256: "y", verified: false }] }], nextTasks: [], retired: false },
    null,
  );
  assert.equal(r.isOk, false);
  assert.equal(r.error.code, "E_BADGE_UNVERIFIED");
});

test("pitra agent cannot carry next tasks", () => {
  const r = recordReward(
    { role: "agent0", task: "task2", taskTitle: "t", artifacts: [artifact], badges: [], nextTasks: ["more"], retired: true, lineage: "pitra" },
    null,
  );
  assert.equal(r.isOk, false);
  assert.equal(r.error.code, "E_RETIRED_HAS_TASKS");
});

test("pitra agent may only hold pitra-tier badges", () => {
  const r = recordReward(
    { role: "agent0", task: "task2", taskTitle: "t", artifacts: [artifact], badges: [{ id: "b", label: "B", tier: "standard", evidence: ev }], nextTasks: [], retired: true, lineage: "pitra" },
    null,
  );
  assert.equal(r.isOk, false);
  assert.equal(r.error.code, "E_PITRA_BADGE_TIER");
});

test("buildLedger chains hashes and validateLedger confirms integrity", () => {
  const r = buildLedger([
    { role: "agent1", task: "task1", taskTitle: "research", artifacts: [artifact], badges: [{ id: "evidence-sourced", label: "Evidence Sourced", tier: "standard", evidence: ev }], nextTasks: ["follow"], retired: false },
    { role: "agent0", task: "task2", taskTitle: "seed", artifacts: [artifact], badges: [{ id: "pitra-foundational", label: "Pitra", tier: "pitra", evidence: ev }], nextTasks: [], retired: true, lineage: "pitra" },
  ]);
  assert.equal(r.isOk, true);
  assert.equal(r.data.rewards.length, 2);
  assert.equal(r.data.rewards[0].prevHash, null);
  assert.equal(r.data.rewards[1].prevHash, r.data.rewards[0].hash);
  assert.equal(r.data.__meta.governedProductionGo, false);
  const v = validateLedger(r.data);
  assert.equal(v.isOk, true);
  assert.equal(v.data.chainOk, true);
});

test("validateLedger detects tampering with a permanent id", () => {
  const r = buildLedger([
    { role: "agent1", task: "task1", taskTitle: "research", artifacts: [artifact], badges: [], nextTasks: [], retired: false },
  ]);
  const tampered = structuredClone(r.data);
  tampered.rewards[0].permanentId = "agent:agent1:deadbeef0000";
  const v = validateLedger(tampered);
  assert.equal(v.isOk, false);
  assert.equal(v.error.code, "E_ID_MISMATCH");
});

test("health reports ready for a valid ledger and exposes no production-GO", () => {
  const r = buildLedger([
    { role: "agent0", task: "task2", taskTitle: "seed", artifacts: [artifact], badges: [], nextTasks: [], retired: true, lineage: "pitra" },
  ]);
  const h = health(r.data);
  assert.equal(h.status, "ready");
  assert.equal(h.entries, 1);
  assert.equal(h.pitra, 1);
  assert.equal(h.governedProductionGo, false);
  assert.equal(typeof rewards.mintPermanentId, "function");
});
