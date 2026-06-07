import { test } from "node:test";
import assert from "node:assert/strict";
import { reset, registerAgent, start, stop, runTask, status, list, health } from "../packages/runtime-agent-supervisor/src/index.ts";

test("registerAgent registers a real handler agent", () => {
  reset();
  const r = registerAgent("upper", (t) => String(t).toUpperCase());
  assert.ok(r.isOk);
  assert.match(r.data.id, /^agent-/);
  assert.equal(status(r.data.id).data.state, "registered");
  assert.equal(registerAgent("bad", null).isOk, false);
});

test("agent lifecycle: start → running, stop → stopped", () => {
  reset();
  const a = registerAgent("x", () => 1);
  assert.equal(start(a.data.id).data.state, "running");
  assert.equal(stop(a.data.id).data.state, "stopped");
  assert.equal(start("agent-nope").isOk, false);
});

test("runTask executes through a running agent (real handler invocation)", () => {
  reset();
  const a = registerAgent("sum", (t) => (t as number[]).reduce((s, n) => s + n, 0));
  start(a.data.id);
  const r = runTask(a.data.id, [1, 2, 3]);
  assert.ok(r.isOk);
  assert.equal(r.data.result, 6);
  assert.equal(r.data.runs, 1);
});

test("runTask is fail-closed: not-running, unknown, and throwing handlers", () => {
  reset();
  const a = registerAgent("boom", () => { throw new Error("kaboom"); });
  assert.equal(runTask(a.data.id, {}).isOk, false);          // registered, not running
  assert.equal(runTask("agent-nope", {}).isOk, false);        // unknown
  start(a.data.id);
  const thrown = runTask(a.data.id, {});
  assert.equal(thrown.isOk, false);                            // handler threw → caught
  assert.equal(status(a.data.id).data.failures, 1);           // counted, not crashed
});

test("status/list report real supervised state and run accounting", () => {
  reset();
  const a = registerAgent("a", () => 1);
  const b = registerAgent("b", () => 2);
  start(a.data.id); runTask(a.data.id, {}); runTask(a.data.id, {});
  const l = list();
  assert.equal(l.data.count, 2);
  assert.equal(l.data.running, 1);
  assert.equal(status(a.data.id).data.runs, 2);
  const h = health();
  assert.equal(h.evidence.totalRuns, 2);
  assert.equal(h.__meta.governedProductionGo, false);
});
