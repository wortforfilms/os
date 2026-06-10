// Real integration tests for @maataa/runtime-analytics.
// Persistence-backed, deterministic, fail-closed. No mocks, no fabricated counts.
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AnalyticsRuntime } from "../packages/runtime-analytics/src/index.ts";

const dbFile = () => join(mkdtempSync(join(tmpdir(), "maataa-analytics-")), "analytics.sqlite");

test("aggregate reflects exactly the recorded events (no invention)", () => {
  const a = new AnalyticsRuntime(dbFile());
  assert.equal(a.aggregate().totalEvents, 0); // empty = zero, not a fake number
  a.record({ type: "login", actor: "alice", ts: 1000 });
  a.record({ type: "login", actor: "bob", ts: 1001 });
  a.record({ type: "export", actor: "alice", ts: 1002 });
  const agg = a.aggregate();
  assert.equal(agg.totalEvents, 3);
  assert.deepEqual(agg.byType, { export: 1, login: 2 }); // key-sorted, deterministic
  assert.deepEqual(agg.byActor, { alice: 2, bob: 1 });
  assert.equal(agg.distinctActors, 2);
  assert.equal(agg.firstTs, 1000);
  assert.equal(agg.lastTs, 1002);
  assert.equal(agg.observedNotLive, true);
});

test("events persist across runtime instances (real SQLite)", () => {
  const path = dbFile();
  const w = new AnalyticsRuntime(path);
  w.record({ type: "page_view", actor: "carol", ts: 5 });
  w.record({ type: "page_view", actor: "carol", ts: 6 });
  const r = new AnalyticsRuntime(path); // fresh instance, same store
  assert.equal(r.aggregate().totalEvents, 2);
  assert.equal(r.aggregate().byType.page_view, 2);
  assert.equal(r.recent(1)[0].ts, 6); // most recent first
});

test("fail-closed: malformed events are rejected, not coerced", () => {
  const a = new AnalyticsRuntime(dbFile());
  // @ts-expect-error missing type
  assert.throws(() => a.record({ actor: "x" }), /event\.type is required/);
  assert.throws(() => a.record({ type: "  " }), /event\.type is required/);
  assert.equal(a.aggregate().totalEvents, 0); // nothing recorded
});

test("health exposes real totals and never claims production", () => {
  const a = new AnalyticsRuntime(dbFile());
  a.record({ type: "click", ts: 1 });
  const h = a.health();
  assert.equal(h.status, "active");
  assert.equal(h.totalEvents, 1);
  assert.equal(h.governedProductionGo, false);
});

test("reset clears recorded events (rollbackable)", () => {
  const a = new AnalyticsRuntime(dbFile());
  a.record({ type: "x", ts: 1 });
  assert.equal(a.aggregate().totalEvents, 1);
  a.reset();
  assert.equal(a.aggregate().totalEvents, 0);
});
