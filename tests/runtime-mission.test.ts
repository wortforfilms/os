import { test } from "node:test";
import assert from "node:assert/strict";
import {
  reset, declareMission, recordObservation, assess, propose, enforceProposal, health,
} from "../packages/runtime-mission/src/index.ts";
import { reset as resetGovernance, definePolicy } from "../packages/runtime-governance/src/index.ts";

test("runtime-mission: declare → observe → assess computes real drift", async () => {
  reset();
  const d = await declareMission({
    name: "knowledge-coverage",
    declaredState: { scripts: 426, attested: true },
    observableQueries: ["count(scripts)"],
    acceptanceThresholds: { scripts: 426 },
  });
  assert.ok(d.isOk);
  const id = d.data!.missionId;

  // observe one key matching, one differing; leave nothing for 'attested' (unobserved)
  assert.ok((await recordObservation(id, "scripts", 12)).isOk); // differs from declared 426

  const a = await assess(id);
  assert.ok(a.isOk);
  const keys = a.data!.driftItems.map((x) => x.key).sort();
  assert.deepEqual(keys, ["attested", "scripts"]);
  const scripts = a.data!.driftItems.find((x) => x.key === "scripts")!;
  assert.equal(scripts.observed, 12);
  assert.equal(scripts.confidence, 1); // observed
  const attested = a.data!.driftItems.find((x) => x.key === "attested")!;
  assert.equal(attested.confidence, 0.1); // unobserved
});

test("runtime-mission: propose delegates a candidate to runtime-governance enforcement", async () => {
  reset();
  resetGovernance();
  assert.ok(definePolicy({ name: "observed-required", key: "observed", op: "truthy", severity: "block" }).isOk);

  const d = await declareMission({ name: "m", declaredState: { x: 1 }, observableQueries: [], acceptanceThresholds: {} });
  const p = await propose(d.data!.missionId);
  assert.ok(p.isOk);
  assert.equal(p.data!.enforcement, "deferred-to-runtime-governance");
  assert.ok(p.data!.candidates.length >= 1);

  const enforced = enforceProposal(p.data!.candidates[0]);
  assert.ok(enforced.isOk);
  assert.equal(enforced.data!.decision, "block");
  assert.equal(enforced.data!.violations[0].name, "observed-required");
});

test("runtime-mission: fail-closed on unknown mission", async () => {
  reset();
  const a = await assess("mission:nope");
  assert.equal(a.isOk, false);
  assert.equal((a as { error: { code: string } }).error.code, "unknown_mission");
});

test("runtime-mission: health reports ready, advisory, not production-GO", async () => {
  reset();
  const h = health();
  assert.equal(h.status, "ready");
  assert.equal(h.initialized, true);
  assert.equal(h.evidence.enforcementOwner, "runtime-governance (wired)");
  assert.equal(h.__meta.governedProductionGo, false);
});
