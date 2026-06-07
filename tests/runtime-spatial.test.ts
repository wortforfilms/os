import { test } from "node:test";
import assert from "node:assert/strict";
import { reset, insert, remove, rangeQuery, nearest, knn, withinRadius, bounds, health } from "../packages/runtime-spatial/src/index.ts";

test("insert stores points and is fail-closed on bad coords", () => {
  reset();
  assert.equal(insert("a", 0, 0).data.count, 1);
  assert.equal(insert("b", 10, 10).data.count, 2);
  assert.equal(insert("a", 1, 1).data.count, 2); // upsert
  assert.equal(insert("", 0, 0).isOk, false);
  assert.equal(insert("c", NaN, 0).isOk, false);
  assert.equal(insert("c", 0, Infinity).isOk, false);
});

test("remove deletes and fails closed on unknown", () => {
  reset();
  insert("a", 0, 0);
  assert.equal(remove("a").data.count, 0);
  assert.equal(remove("a").isOk, false);
});

test("rangeQuery returns points inside an inclusive bbox", () => {
  reset();
  insert("a", 0, 0); insert("b", 5, 5); insert("c", 10, 10);
  const r = rangeQuery(0, 0, 6, 6);
  assert.ok(r.isOk);
  const ids = r.data.points.map((p) => p.id).sort();
  assert.deepEqual(ids, ["a", "b"]);
  assert.equal(rangeQuery(NaN, 0, 1, 1).isOk, false);
});

test("nearest returns the closest point with real distance; empty fails closed", () => {
  reset();
  assert.equal(nearest(0, 0).isOk, false);
  insert("a", 0, 0); insert("b", 3, 4); // dist 5
  const n = nearest(3, 5);
  assert.ok(n.isOk);
  assert.equal(n.data.point.id, "b");
  assert.equal(n.data.distance, 1);
});

test("knn returns k closest sorted; fail-closed on bad k", () => {
  reset();
  insert("a", 0, 0); insert("b", 1, 0); insert("c", 5, 0); insert("d", 2, 0);
  const r = knn(0, 0, 2);
  assert.ok(r.isOk);
  assert.deepEqual(r.data.points.map((p) => p.id), ["a", "b"]);
  assert.equal(knn(0, 0, 0).isOk, false);
});

test("withinRadius and bounds compute real geometry", () => {
  reset();
  insert("a", 0, 0); insert("b", 3, 4); insert("c", 100, 100);
  const w = withinRadius(0, 0, 5);
  assert.deepEqual(w.data.points.map((p) => p.id).sort(), ["a", "b"]);
  assert.equal(withinRadius(0, 0, -1).isOk, false);
  const b = bounds();
  assert.deepEqual(b.data, { minX: 0, minY: 0, maxX: 100, maxY: 100 });
});

test("health reports real counts and is not production-GO", () => {
  reset();
  insert("a", 0, 0);
  const h = health();
  assert.equal(h.evidence.pointCount, 1);
  assert.equal(h.status, "ready");
  assert.equal(h.__meta.governedProductionGo, false);
});
