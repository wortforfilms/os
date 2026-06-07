import { test } from "node:test";
import assert from "node:assert/strict";
import {
  reset, registerAgent, start, runTask, enqueue, processQueue, history, route, setFailurePolicy, fanOut,
} from "../packages/runtime-agent-supervisor/src/index.ts";

test("enqueue + processQueue drains buffered tasks FIFO through a running agent", () => {
  reset();
  const a = registerAgent("double", (t) => (t as number) * 2);
  start(a.data.id);
  enqueue(a.data.id, 2); enqueue(a.data.id, 3); enqueue(a.data.id, 4);
  const r = processQueue(a.data.id);
  assert.ok(r.isOk);
  assert.equal(r.data.processed, 3);
  assert.deepEqual(r.data.results, [4, 6, 8]);
  assert.equal(processQueue("agent-nope").isOk, false);
});

test("processQueue is fail-closed when the agent is not running", () => {
  reset();
  const a = registerAgent("x", () => 1);
  enqueue(a.data.id, 1);
  assert.equal(processQueue(a.data.id).isOk, false); // registered, not running
});

test("history records a real per-run audit log (ok + failures)", () => {
  reset();
  let n = 0;
  const a = registerAgent("flaky", () => { if (++n === 2) throw new Error("boom"); return n; });
  start(a.data.id);
  runTask(a.data.id, {}); runTask(a.data.id, {}); runTask(a.data.id, {});
  const h = history(a.data.id);
  assert.equal(h.data.runs.length, 3);
  assert.deepEqual(h.data.runs.map((r) => r.ok), [true, false, true]);
});

test("route dispatches to the first running agent with a capability tag", () => {
  reset();
  registerAgent("noTag", () => "x");
  const b = registerAgent("ocr", (t) => `ocr:${t}`, { tags: ["ocr"] });
  start(b.data.id);
  const r = route("ocr", "img");
  assert.ok(r.isOk);
  assert.equal(r.data.agentId, b.data.id);
  assert.equal(r.data.result, "ocr:img");
  assert.equal(route("missing-cap", "x").isOk, false);
});

test("failure policy auto-stops a flapping agent; fanOut spreads a task", () => {
  reset();
  const a = registerAgent("bad", () => { throw new Error("nope"); });
  start(a.data.id);
  setFailurePolicy(a.data.id, 2);
  runTask(a.data.id, {}); // failure 1
  runTask(a.data.id, {}); // failure 2 → auto-stop
  assert.equal(runTask(a.data.id, {}).isOk, false); // now stopped → rejected

  const g1 = registerAgent("g1", () => 1); const g2 = registerAgent("g2", () => 2);
  start(g1.data.id); start(g2.data.id);
  const f = fanOut([g1.data.id, g2.data.id, "agent-nope"], {});
  assert.equal(f.data.results.filter((r) => r.ok).length, 2);
  assert.equal(f.data.results.find((r) => r.id === "agent-nope").ok, false);
});
