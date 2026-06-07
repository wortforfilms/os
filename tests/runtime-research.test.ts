import { test } from "node:test";
import assert from "node:assert/strict";
import { reset, registerHypothesis, addExperiment, addEvidence, assess, list, health } from "../packages/runtime-research/src/index.ts";

test("registerHypothesis + addExperiment record real research artifacts", () => {
  reset();
  const h = registerHypothesis("water boils at 100C at 1atm");
  assert.ok(h.isOk);
  const e = addExperiment(h.data.id, "boil at sea level", "boiled at ~100C");
  assert.equal(e.data.experiments, 1);
  assert.equal(addExperiment("hyp-nope", "x", "y").isOk, false);
  assert.equal(addExperiment(h.data.id, "", "").isOk, false);
});

test("addEvidence is fail-closed on malformed input", () => {
  reset();
  const h = registerHypothesis("h");
  assert.ok(addEvidence(h.data.id, { ref: "r", weight: 2, supports: true }).isOk);
  assert.equal(addEvidence(h.data.id, { ref: "r", weight: 2 } as any).isOk, false);
  assert.equal(addEvidence("hyp-nope", { ref: "r", weight: 1, supports: true }).isOk, false);
});

test("assess computes a transparent support score (supported)", () => {
  reset();
  const h = registerHypothesis("supported-claim");
  addEvidence(h.data.id, { ref: "a", weight: 5, supports: true });
  addEvidence(h.data.id, { ref: "b", weight: 1, supports: false });
  const a = assess(h.data.id);
  assert.ok(a.isOk);
  assert.equal(a.data.for, 5);
  assert.equal(a.data.against, 1);
  assert.equal(a.data.supportScore, 0.667); // (5-1)/6
  assert.equal(a.data.status, "supported");
});

test("assess: refuted and inconclusive cases + fail-closed", () => {
  reset();
  const r = registerHypothesis("refuted");
  addEvidence(r.data.id, { ref: "a", weight: 1, supports: true });
  addEvidence(r.data.id, { ref: "b", weight: 5, supports: false });
  assert.equal(assess(r.data.id).data.status, "refuted");

  const i = registerHypothesis("balanced");
  addEvidence(i.data.id, { ref: "a", weight: 2, supports: true });
  addEvidence(i.data.id, { ref: "b", weight: 2, supports: false });
  assert.equal(assess(i.data.id).data.status, "inconclusive");
  assert.equal(assess("hyp-nope").isOk, false);
});

test("list + health report real counts, advisory, not production-GO", () => {
  reset();
  const h = registerHypothesis("h");
  addEvidence(h.data.id, { ref: "a", weight: 3, supports: true });
  const l = list();
  assert.equal(l.data.count, 1);
  assert.equal(l.data.items[0].status, "supported");
  const hh = health();
  assert.equal(hh.evidence.hypotheses, 1);
  assert.equal(hh.evidence.totalEvidence, 1);
  assert.equal(hh.__meta.governedProductionGo, false);
});
