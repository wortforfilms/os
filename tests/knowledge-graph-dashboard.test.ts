import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildKnowledgeGraphDashboard,
  knowledgeGraphDashboardHealth,
  renderKnowledgeGraphDashboardHtml,
} from "../packages/dashboard-knowledge-graph/src/index.ts";
import { kbsGraphEdges, kbsGraphNodes } from "../packages/kbs-graph/src/index.ts";

test("knowledge graph dashboard renders the current local KBS graph", () => {
  const dashboard = buildKnowledgeGraphDashboard({ focusNodeId: "claim-brahmi-origin" });

  assert.equal(dashboard.status, "PREVIEW_VERIFIED");
  assert.equal(dashboard.graph.valid, true);
  assert.equal(dashboard.metrics.nodes, kbsGraphNodes.length);
  assert.equal(dashboard.metrics.edges, kbsGraphEdges.length);
  assert.equal(dashboard.productionReady, false);
  assert.equal(dashboard.phkdVerdict, "BLOCKED");
  assert.ok(dashboard.neighborhood.includes("domain-lipi"));
  assert.ok(dashboard.rows.some((row) => row.id === "claim-brahmi-origin" && row.evidencePath === "packages/kbs-runtime/src/data.ts"));
});

test("knowledge graph dashboard HTML includes metrics, rows, and no-go status", () => {
  const html = renderKnowledgeGraphDashboardHtml();

  assert.match(html, /Knowledge Graph Dashboard/);
  assert.match(html, /nodes=8; edges=6; valid=true/);
  assert.match(html, /claim-brahmi-origin/);
  assert.match(html, /FINAL_STATUS=BLOCKED/);
  assert.match(html, /PRODUCTION_READY=FALSE/);
  assert.doesNotMatch(html, /PRODUCTION_READY=TRUE/);
});

test("knowledge graph dashboard blocks invalid graph data", () => {
  const dashboard = buildKnowledgeGraphDashboard({
    nodes: kbsGraphNodes,
    edges: [{ ...kbsGraphEdges[0], to: "missing-node" }],
    focusNodeId: "claim-brahmi-origin",
  });

  assert.equal(dashboard.status, "BLOCKED");
  assert.equal(dashboard.graph.valid, false);
  assert.deepEqual(dashboard.graph.missingNodeIds, ["missing-node"]);
  assert.ok(dashboard.blockers.some((blocker) => blocker.includes("graph validation failed")));
  assert.equal(dashboard.productionReady, false);
});

test("knowledge graph dashboard health is local preview only", () => {
  const health = knowledgeGraphDashboardHealth();

  assert.equal(health.status, "PREVIEW_VERIFIED");
  assert.equal(health.graphValid, true);
  assert.equal(health.nodes, kbsGraphNodes.length);
  assert.equal(health.edges, kbsGraphEdges.length);
  assert.equal(health.productionReady, false);
  assert.equal(health.phkdVerdict, "BLOCKED");
  assert.ok(health.blockers.some((blocker) => /no live deployment/i.test(blocker)));
});
