import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLipiDashboard, lipiDashboardHealth, renderLipiDashboardHtml } from "../packages/lipi-dashboard/src/index.ts";

test("lipi dashboard renders learning progress from seeded runtime lessons", () => {
  const dashboard = buildLipiDashboard();

  assert.equal(dashboard.status, "PREVIEW_VERIFIED");
  assert.equal(dashboard.totals.lessons, 3);
  assert.equal(dashboard.totals.previewLessons, 2);
  assert.equal(dashboard.totals.blockedLessons, 1);
  assert.equal(dashboard.progress.previewPercent, 66.7);
  assert.equal(dashboard.progress.blockedPercent, 33.3);
  assert.ok(dashboard.rows.some((row) => row.id === "brahmi-foundation" && row.scriptName === "Brahmi"));
  assert.ok(dashboard.rows.some((row) => row.id === "siddham-mantra-grid" && row.blocker));
  assert.equal(dashboard.productionReady, false);
  assert.equal(dashboard.phkdVerdict, "BLOCKED");
});

test("lipi dashboard keeps accuracy UNKNOWN without learner telemetry", () => {
  const dashboard = buildLipiDashboard();

  assert.equal(dashboard.accuracy.state, "UNKNOWN");
  assert.equal(dashboard.accuracy.accuracyPercent, null);
  assert.match(dashboard.accuracy.evidence, /UNKNOWN/);
  assert.ok(dashboard.blockers.some((blocker) => /accuracy is UNKNOWN/i.test(blocker)));
});

test("lipi dashboard measures preview accuracy only from supplied attempts", () => {
  const dashboard = buildLipiDashboard([
    { anchorId: "brahmi-a", answer: "a" },
    { anchorId: "brahmi-ka", answer: "wrong" },
  ]);

  assert.equal(dashboard.accuracy.state, "MEASURED_PREVIEW");
  assert.equal(dashboard.accuracy.attempts, 2);
  assert.equal(dashboard.accuracy.correct, 1);
  assert.equal(dashboard.accuracy.accuracyPercent, 50);
  assert.match(dashboard.accuracy.evidence, /not production learner telemetry/);
});

test("lipi dashboard HTML and health preserve no-go status", () => {
  const html = renderLipiDashboardHtml();
  const health = lipiDashboardHealth();

  assert.match(html, /Lipi Dashboard/);
  assert.match(html, /Learning Progress/);
  assert.match(html, /Accuracy/);
  assert.match(html, /accuracy=UNKNOWN/);
  assert.match(html, /PRODUCTION_READY=FALSE/);
  assert.doesNotMatch(html, /PRODUCTION_READY=TRUE/);
  assert.equal(health.status, "PREVIEW_VERIFIED");
  assert.equal(health.accuracyState, "UNKNOWN");
  assert.equal(health.productionReady, false);
  assert.equal(health.phkdVerdict, "BLOCKED");
});
