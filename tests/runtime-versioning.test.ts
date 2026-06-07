import { test } from "node:test";
import assert from "node:assert/strict";
import { reset, snapshot, history, get, diff, rollback, health } from "../packages/runtime-versioning/src/index.ts";

test("snapshot appends versions with content hashes", () => {
  reset();
  const a = snapshot("doc", { title: "v1" });
  const b = snapshot("doc", { title: "v2" });
  assert.equal(a.data.version, 1);
  assert.equal(b.data.version, 2);
  assert.notEqual(a.data.hash, b.data.hash);
  assert.equal(snapshot("", {}).isOk, false);
});

test("history lists all versions; fail-closed on unknown key", () => {
  reset();
  snapshot("k", 1); snapshot("k", 2); snapshot("k", 3);
  assert.equal(history("k").data.versions.length, 3);
  assert.equal(history("nope").isOk, false);
});

test("get returns latest by default or a pinned version (fail-closed on bad version)", () => {
  reset();
  snapshot("k", "first"); snapshot("k", "second");
  assert.equal(get("k").data.value, "second");
  assert.equal(get("k", 1).data.value, "first");
  assert.equal(get("k", 99).isOk, false);
});

test("diff computes real added/removed/changed keys between versions", () => {
  reset();
  snapshot("o", { a: 1, b: 2 });
  snapshot("o", { a: 1, b: 9, c: 3 }); // b changed, c added
  const d = diff("o", 1, 2);
  assert.ok(d.isOk);
  assert.deepEqual(d.data.added, ["c"]);
  assert.deepEqual(d.data.changed, ["b"]);
  assert.deepEqual(d.data.removed, []);
});

test("rollback restores an earlier value as a NEW version (non-destructive)", () => {
  reset();
  snapshot("k", "good");   // v1
  snapshot("k", "bad");    // v2
  const r = rollback("k", 1);
  assert.ok(r.isOk);
  assert.equal(r.data.version, 3);            // new version, history preserved
  assert.equal(get("k").data.value, "good");  // latest now equals v1's value
  assert.equal(history("k").data.versions.length, 3);
  const h = health();
  assert.equal(h.evidence.totalVersions, 3);
  assert.equal(h.__meta.governedProductionGo, false);
});
