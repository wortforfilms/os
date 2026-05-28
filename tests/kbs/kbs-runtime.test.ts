import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bindEvidenceHash,
  citationSearch,
  classifyClaim,
  detectContradictions,
  enqueueReview,
  evaluateKbsGate,
  exportEvidenceManifest,
  freezeUnsupportedClaim,
  graphMetrics,
  kbsClaims,
  kbsGovernanceState,
  kbsGraphEdges,
  kbsGraphNodes,
  kbsRuntimeBoard,
  kbsSources,
  keywordSearch,
  moderateClaim,
  stableHash,
  summarizeKbsRuntimeBoard,
  traverseFrom,
  validateGraph
} from "../../packages/kbs-runtime/src/index.ts";
import runtimeBoardExtraction from "../../data/kbs-runtime-board-extraction.json" with { type: "json" };
import { createKbsClient, kbsOpenApiSpec } from "../../packages/kbs-sdk/src/index.ts";

test("claim validation blocks unsupported or uncited claims", () => {
  const blocked = freezeUnsupportedClaim({
    id: "claim-fake",
    text: "Verified without source production ready claim",
    domain: "Technical",
    status: "UNVERIFIED",
    citations: [],
    evidenceIds: [],
    confidence: 0,
    frozen: false
  }, kbsSources);

  assert.equal(blocked.status, "BLOCKED");
  assert.equal(blocked.frozen, true);
  assert.equal(classifyClaim(kbsClaims[0], kbsSources), "VERIFIED");
});

test("graph integrity validates known nodes and rejects missing nodes", () => {
  const validGraph = validateGraph(kbsGraphNodes, kbsGraphEdges);
  assert.equal(validGraph.valid, true);
  assert.deepEqual(validGraph.missingNodeIds, []);
  const badGraph = validateGraph(kbsGraphNodes, [{ ...kbsGraphEdges[0], to: "missing-node" }]);
  assert.equal(badGraph.valid, false);
  assert.deepEqual(badGraph.missingNodeIds, ["missing-node"]);
});

test("citation lineage and search return real local records", () => {
  assert.equal(citationSearch("section 2", kbsClaims).length, 1);
  assert.ok(keywordSearch("brahmi", kbsClaims, kbsSources).some((item) => item.id === "claim-brahmi-origin"));
});

test("moderation workflow blocks fake citations and queues review", () => {
  const moderated = moderateClaim({
    ...kbsClaims[0],
    text: "Claim with fake citation"
  });
  assert.equal(moderated.status, "BLOCKED");
  assert.equal(enqueueReview(kbsClaims[0].id, "SCHOLAR", "Scholar review").status, "PENDING");
});

test("API SDK contract exposes local guarded client without production claim", async () => {
  const client = createKbsClient();
  const claims = await client.claims();
  assert.equal(claims.length, kbsClaims.length);
  assert.ok(kbsOpenApiSpec.paths["/api/kbs/search"]);
});

test("provenance hashing and evidence lineage are deterministic", () => {
  const first = stableHash({ source: "kbs", id: "evidence" });
  const second = stableHash({ id: "evidence", source: "kbs" });
  assert.equal(first, second);
  assert.match(bindEvidenceHash(kbsClaims[0]).hash ?? "", /^kbs:/);
});

test("evidence export carries no production GO", () => {
  const manifest = exportEvidenceManifest({ claims: kbsClaims, sources: kbsSources, nodes: kbsGraphNodes, edges: kbsGraphEdges });
  assert.equal(manifest.finalStatus, "GOVERNED_PRODUCTION_NO_GO");
  assert.equal(manifest.productionReady, false);
});

test("rollback safety and governance remain blocked without real gates", () => {
  const gate = evaluateKbsGate(kbsGovernanceState);
  assert.equal(gate.pass, true);
  assert.equal(kbsGovernanceState.productionReady, false);
  assert.ok(kbsGovernanceState.blockers.includes("rollback_drill_verification_missing"));
});

test("graph traversal and metrics expose local topology", () => {
  assert.ok(traverseFrom("claim-brahmi-origin", kbsGraphEdges).includes("domain-lipi"));
  assert.equal(graphMetrics(kbsGraphNodes, kbsGraphEdges).nodes, kbsGraphNodes.length);
});

test("contradiction detection sees blocked claims", () => {
  const result = detectContradictions(kbsClaims);
  assert.equal(result.hasContradictions, true);
  assert.ok(result.blocked.includes("claim-unsourced-date"));
});

test("extracted KBS runtime board preserves 55 runtime records and no-go status", () => {
  const summary = summarizeKbsRuntimeBoard(kbsRuntimeBoard);
  assert.equal(kbsRuntimeBoard.length, 55);
  assert.equal(summary.totalRuntimes, 55);
  assert.equal(summary.OPERATIONAL, 49);
  assert.equal(summary.DEGRADED, 2);
  assert.equal(summary.MAINTENANCE, 2);
  assert.equal(summary.OFFLINE, 1);
  assert.equal(summary.UNCLASSIFIED, 1);
  assert.equal(summary.productionReady, false);
  assert.equal(summary.finalStatus, "GOVERNED_PRODUCTION_NO_GO");
});

test("runtime board extraction includes dashboard metrics and blockers", () => {
  assert.equal(runtimeBoardExtraction.runtimeSummary.totalRuntimes, 55);
  assert.equal(runtimeBoardExtraction.dashboard.metrics.scripts, 426);
  assert.equal(runtimeBoardExtraction.governance.productionReady, false);
  assert.equal(runtimeBoardExtraction.governance.finalStatus, "GOVERNED_PRODUCTION_NO_GO");
  assert.ok(runtimeBoardExtraction.governance.activeBlockers.includes("hardware_attestation_not_verified"));
});
