import { test } from "node:test";
import assert from "node:assert/strict";
import { reset, schedule, tick, cancel, list, runDue, snapshot, health } from "../packages/runtime-scheduler/src/index.ts";

test("schedule registers tasks and is fail-closed on bad input", () => {
  reset();
  const s = schedule("backup", 10);
  assert.ok(s.isOk);
  assert.equal(s.data.dueAt, 10);
  assert.equal(schedule("", 1).isOk, false);
  assert.equal(schedule("x", -1).isOk, false);
  assert.equal(schedule("x", NaN).isOk, false);
});

test("tick advances the logical clock and marks due tasks; fail-closed on bad delta", () => {
  reset();
  schedule("a", 5);
  schedule("b", 20);
  let t = tick(5);
  assert.ok(t.isOk);
  assert.equal(t.data.clock, 5);
  assert.deepEqual(t.data.due, ["task-1"]);
  assert.deepEqual(tick(5).data.due, []); // b not due yet at clock 10
  assert.equal(tick(0).isOk, false);
  assert.equal(tick(1.5).isOk, false);
});

test("runDue runs due tasks deterministically and increments runs", () => {
  reset();
  schedule("a", 1); schedule("b", 1); schedule("c", 50);
  tick(1);
  const r = runDue();
  assert.ok(r.isOk);
  assert.deepEqual(r.data.ran, ["task-1", "task-2"]); // sorted by dueAt then id
  assert.equal(list("ran").data.count, 2);
  assert.equal(list("scheduled").data.count, 1);
});

test("cancel removes a pending task and fails closed on ran/unknown", () => {
  reset();
  schedule("a", 5);
  assert.ok(cancel("task-1").isOk);
  assert.equal(list("cancelled").data.count, 1);
  assert.equal(cancel("nope").isOk, false);
  // already-ran path
  reset();
  schedule("b", 1); tick(1); runDue();
  assert.equal(cancel("task-1").isOk, false);
});

test("list filters by state and fail-closed on unknown state", () => {
  reset();
  schedule("a", 1);
  assert.equal(list().data.count, 1);
  assert.equal(list("scheduled").data.count, 1);
  assert.equal(list("bogus" as any).isOk, false);
});

test("snapshot is deterministic and health is not production-GO", () => {
  reset();
  schedule("z", 30); schedule("a", 5);
  const s = snapshot();
  assert.deepEqual(s.data.tasks.map((t) => t.name), ["a", "z"]);
  const h = health();
  assert.equal(h.evidence.scheduled, 2);
  assert.equal(h.__meta.governedProductionGo, false);
});
