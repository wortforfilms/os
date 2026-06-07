import { test } from "node:test";
import assert from "node:assert/strict";
import { reset, submitClaim, assess, replicationStatus, health } from "../packages/runtime-validation/src/index.ts";

const claimRef = { runtime: "runtime-knowledge-graph", entityId: "ent-1" } as const;

test("runtime-validation: submit/assess computes confidence from evidence", async () => {
  reset();
  const weak = await submitClaim(claimRef, [{ ref: { runtime: "runtime-hkd-registry", id: "e1" }, weight: 0.5 }], { approach: "observation", preregistered: false, notes: "" });
  const strong = await submitClaim(claimRef, [
    { ref: { runtime: "runtime-hkd-registry", id: "e2" }, weight: 5 },
    { ref: { runtime: "runtime-hkd-registry", id: "e3" }, weight: 5 },
  ], { approach: "experiment", preregistered: true, notes: "" });
  assert.ok(weak.isOk && strong.isOk);

  const aWeak = await assess(weak.data!.validationId);
  const aStrong = await assess(strong.data!.validationId);
  assert.ok(aStrong.data!.confidence > aWeak.data!.confidence); // more evidence => higher confidence
  assert.equal(aStrong.data!.moderationState, "reviewed");      // assess moves pending -> reviewed
  assert.ok(aStrong.data!.uncertainty.epistemic >= 0 && aStrong.data!.uncertainty.aleatoric > 0);
});

test("runtime-validation: replication + fail-closed", async () => {
  reset();
  const s = await submitClaim(claimRef, [], { approach: "theoretical", preregistered: false, notes: "" });
  const rep = await replicationStatus(s.data!.validationId);
  assert.equal(rep.data!.replications, 0);
  const bad = await assess("val-nope");
  assert.equal(bad.isOk, false);
});

test("runtime-validation: health ready, moderation pending by default, not production-GO", async () => {
  reset();
  await submitClaim(claimRef, [], { approach: "observation", preregistered: false, notes: "" });
  const h = health();
  assert.equal(h.status, "ready");
  assert.equal(h.evidence.claimCount, 1);
  assert.equal(h.evidence.pendingAssessments, 1);
  assert.equal(h.__meta.governedProductionGo, false);
});
