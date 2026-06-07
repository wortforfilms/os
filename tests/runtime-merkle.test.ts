import { test } from "node:test";
import assert from "node:assert/strict";
import { reset, build, append, root, size, proof, verify, health } from "../packages/runtime-merkle/src/index.ts";

test("build computes a deterministic root; fail-closed on empty", () => {
  reset();
  const a = build(["a", "b", "c", "d"]);
  assert.ok(a.isOk);
  assert.equal(a.data.size, 4);
  reset();
  const b = build(["a", "b", "c", "d"]);
  assert.equal(b.data.root, a.data.root); // deterministic
  assert.equal(build([]).isOk, false);
  assert.equal(build([1 as any]).isOk, false);
});

test("root changes when data changes (tamper-evident)", () => {
  reset();
  build(["a", "b", "c", "d"]);
  const r1 = root().data.root;
  reset();
  build(["a", "b", "c", "X"]);
  const r2 = root().data.root;
  assert.notEqual(r1, r2);
  reset();
  assert.equal(root().isOk, false); // empty fails closed
});

test("append grows the tree and reports index/size", () => {
  reset();
  assert.equal(append("x").data.index, 0);
  assert.equal(append("y").data.size, 2);
  assert.equal(size().data.size, 2);
  assert.equal(append(5 as any).isOk, false);
});

test("proof + verify: valid inclusion proof verifies against the root", () => {
  reset();
  const items = ["a", "b", "c", "d", "e"]; // odd level to exercise duplication
  build(items);
  const r = root().data.root;
  for (let i = 0; i < items.length; i++) {
    const p = proof(i);
    assert.ok(p.isOk, `proof ${i} ok`);
    const v = verify(items[i], p.data.steps, r);
    assert.ok(v.isOk);
    assert.equal(v.data.valid, true, `item ${i} verifies`);
  }
  assert.equal(proof(99).isOk, false);
});

test("verify rejects a forged item or wrong root (fail-closed integrity)", () => {
  reset();
  build(["a", "b", "c", "d"]);
  const r = root().data.root;
  const p = proof(1);
  assert.equal(verify("NOT-b", p.data.steps, r).data.valid, false);
  assert.equal(verify("b", p.data.steps, "deadbeef").data.valid, false);
  assert.equal(verify("b", "nope" as any, r).isOk, false);
});

test("health reports real leaf count + root and is not production-GO", () => {
  reset();
  build(["a", "b"]);
  const h = health();
  assert.equal(h.evidence.leaves, 2);
  assert.equal(typeof h.evidence.root, "string");
  assert.equal(h.__meta.governedProductionGo, false);
});
