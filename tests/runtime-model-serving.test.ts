import { test } from "node:test";
import assert from "node:assert/strict";
import { reset, registerModel, infer, inferByName, metrics, evaluate, health } from "../packages/runtime-model-serving/src/index.ts";

test("registerModel + infer runs a real deterministic model", () => {
  reset();
  const m = registerModel("double", (x) => (x as number) * 2);
  assert.ok(m.isOk);
  const r = infer(m.data.id, 21);
  assert.equal(r.data.output, 42);
  assert.equal(r.data.inferences, 1);
  assert.equal(infer("model-nope", 1).isOk, false); // fail-closed
});

test("version routing: inferByName picks latest unless pinned", () => {
  reset();
  registerModel("clf", () => "v1", { version: 1 });
  registerModel("clf", () => "v2", { version: 2 });
  assert.equal(inferByName("clf", {}).data.output, "v2");          // latest
  assert.equal(inferByName("clf", {}, 1).data.output, "v1");        // pinned
  assert.equal(inferByName("missing", {}).isOk, false);
});

test("metrics report real inference counts", () => {
  reset();
  const m = registerModel("m", (x) => x);
  infer(m.data.id, 1); infer(m.data.id, 2);
  assert.equal(metrics(m.data.id).data.inferences, 2);
  assert.equal(metrics("model-nope").isOk, false);
});

test("evaluate measures REAL accuracy on labelled samples (not fabricated)", () => {
  reset();
  // parity model: even → "even", odd → "odd"; deliberately wrong on one sample
  const m = registerModel("parity", (x) => ((x as number) % 2 === 0 ? "even" : "odd"));
  const r = evaluate(m.data.id, [
    { input: 2, expected: "even" },
    { input: 3, expected: "odd" },
    { input: 4, expected: "even" },
    { input: 5, expected: "even" }, // wrong on purpose
  ]);
  assert.ok(r.isOk);
  assert.equal(r.data.n, 4);
  assert.equal(r.data.correct, 3);
  assert.equal(r.data.accuracy, 0.75); // measured, not 94.3%
  assert.equal(evaluate(m.data.id, []).isOk, false);
});

test("health reports real model/inference counts, not production-GO", () => {
  reset();
  const m = registerModel("m", (x) => x);
  infer(m.data.id, 1);
  const h = health();
  assert.equal(h.evidence.modelCount, 1);
  assert.equal(h.evidence.totalInferences, 1);
  assert.equal(h.__meta.governedProductionGo, false);
});
