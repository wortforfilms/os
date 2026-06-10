import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createSupervisor } = require("../src/runtime/agent-supervisor.cjs");
const { createJobRunner, demoSyncSource } = require("../apps/electron/job-runner.cjs");

function withRunner(fn) {
  const dir = mkdtempSync(join(tmpdir(), "maataa-jobs-"));
  const sup = createSupervisor(join(dir, "agents.sqlite"));
  const runner = createJobRunner(sup);
  try {
    fn(sup, runner);
  } finally {
    runner.stopAll();
    sup.shutdown();
    rmSync(dir, { recursive: true, force: true });
  }
}

test("two agents split the work roughly evenly for throughput", () => {
  withRunner((sup, runner) => {
    runner.defineJob({ id: "sync", name: "Data Sync", agents: ["sync-a", "sync-b"], source: demoSyncSource(50) });
    const res = runner.runOnce("sync");
    assert.equal(res.ok, true);
    assert.equal(res.items, 50);
    assert.equal(res.processed, 50);
    assert.deepEqual(res.workers.sort(), ["sync-a", "sync-b"]);
    // 50 items across 2 agents => 25 each.
    assert.equal(res.perAgent["sync-a"].processed, 25);
    assert.equal(res.perAgent["sync-b"].processed, 25);
  });
});

test("split is provable from the DB task log", () => {
  withRunner((sup, runner) => {
    runner.defineJob({ id: "sync", agents: ["sync-a", "sync-b"], source: demoSyncSource(40) });
    runner.runOnce("sync");
    const report = runner.splitReport("sync");
    assert.equal(report.tasksByAgent["sync-a"].completed, 20);
    assert.equal(report.tasksByAgent["sync-b"].completed, 20);
  });
});

test("if one agent is down, the healthy one covers all the work", () => {
  withRunner((sup, runner) => {
    runner.defineJob({ id: "sync", agents: ["sync-a", "sync-b"], source: demoSyncSource(30) });
    // sync-b stops heartbeating.
    sup.stop("sync-b");
    const res = runner.runOnce("sync");
    assert.deepEqual(res.workers, ["sync-a"]);
    assert.equal(res.perAgent["sync-a"].processed, 30);
    assert.equal(res.processed, 30);
  });
});

test("handler errors are recorded as failed, not swallowed", () => {
  withRunner((sup, runner) => {
    runner.defineJob({
      id: "sync",
      agents: ["sync-a", "sync-b"],
      source: demoSyncSource(10),
      handler: (item) => { if (item.id % 5 === 0) throw new Error("sync failed"); },
    });
    const res = runner.runOnce("sync");
    assert.equal(res.failed, 2);       // ids 5 and 10
    assert.equal(res.processed, 8);
  });
});

test("repeated cycles accumulate throughput across both agents", () => {
  withRunner((sup, runner) => {
    runner.defineJob({ id: "sync", agents: ["sync-a", "sync-b"], source: demoSyncSource(20) });
    runner.runOnce("sync");
    runner.runOnce("sync");
    runner.runOnce("sync");
    const report = runner.splitReport("sync");
    assert.equal(report.tasksByAgent["sync-a"].completed, 30); // 10 * 3
    assert.equal(report.tasksByAgent["sync-b"].completed, 30);
  });
});
