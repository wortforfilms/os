import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getLipiEvidenceFederationView,
  getLipiKbsGraphView,
  getLipiNumeralZeroView,
  getLipiPhase17To19GovernanceView,
  getLipiRegistryRecords,
  getLipiRegistryRuntimeActivationView,
  getLipiRegistryScript,
  getLipiRegistryStats,
  getLipiUnicodeCrosswalk,
  getLipiZeroRegistryView,
} from "../src/lipi-registry/api.ts";
import {
  isLipiFullRoute,
  lipiFullRoutes,
  lipiFullWorkspaceFromRoute,
  lipiFullWorkspaces,
} from "../src/lipi-full/surface.ts";
import { buildUnifiedSearchIndex, isNavigableSearchResult, searchUnifiedIndex } from "../src/search/index.ts";

const expectedRoutes = [
  "/lipi",
  "/lipi/explorer",
  "/lipi/scripts",
  "/lipi/numerals",
  "/lipi/zero-registry",
  "/lipi/unicode",
  "/lipi/crosswalks",
  "/lipi/kbs",
  "/lipi/evidence",
  "/lipi/federation",
  "/lipi/ingestion",
  "/lipi/runtime-status",
  "/lipi/governance",
  "/lipi/review",
  "/lipi/audit",
  "/lipi/export",
  "/lipi/release",
  "/lipi/api",
];

test("Lipi Full declares every requested workspace route plus script detail routing", () => {
  assert.deepEqual([...lipiFullRoutes], expectedRoutes);
  assert.equal(lipiFullWorkspaces.length, expectedRoutes.length);

  for (const route of expectedRoutes) {
    assert.equal(isLipiFullRoute(route), true, `${route} should be routable`);
  }

  assert.equal(isLipiFullRoute("/lipi/script/unicode-devanagari"), true);
  assert.equal(lipiFullWorkspaceFromRoute("/lipi/script/unicode-devanagari"), "script-detail");
  assert.equal(lipiFullWorkspaceFromRoute("/lipi/governance"), "governance");
});

test("Lipi Full headline metrics come from registry and evidence APIs", () => {
  const records = getLipiRegistryRecords();
  const stats = getLipiRegistryStats(records);
  const crosswalk = getLipiUnicodeCrosswalk();
  const numerals = getLipiNumeralZeroView();
  const zero = getLipiZeroRegistryView();
  const kbs = getLipiKbsGraphView();
  const federation = getLipiEvidenceFederationView();
  const governance = getLipiPhase17To19GovernanceView();
  const activation = getLipiRegistryRuntimeActivationView();

  assert.equal(records.length, 426);
  assert.equal(stats.byClass.unicode, 176);
  assert.equal(crosswalk.total, 176);
  assert.equal(numerals.summary.rowsWithDigitInventory, 63);
  assert.equal(zero.summary.zeroGlyphScripts, 63);
  assert.equal(kbs.summary.totalNodes, 3372);
  assert.equal(kbs.summary.totalEdges, 5233);
  assert.equal(federation.sourceRegistry.summary.sources, 7);
  assert.equal(federation.lineageGraph.summary.nodes, 36);
  assert.equal(federation.lineageGraph.summary.edges, 28);
  assert.equal(governance.phase19.productionGoGate.summary.runtimeEnabled, 0);
  assert.equal(governance.phase19.productionGoGate.summary.productionReady, false);
  assert.equal(governance.phase19.productionGoGate.summary.humanApprovalPresent, false);
  assert.equal(governance.phase19.productionGoGate.summary.productionGoApproved, false);
  assert.equal(activation.registryRuntimeActive, true);
  assert.equal(activation.runtimeMode, "CONTROLLED_PREVIEW");
  assert.equal(activation.runtimeEnabledRows, 0);
});

test("Lipi Full search results expose workspaces as navigable controlled-no-go routes", () => {
  const index = buildUnifiedSearchIndex();
  const routeResults = index.filter((entry) => entry.id.startsWith("route:/lipi"));

  for (const route of expectedRoutes) {
    const result = routeResults.find((entry) => entry.path === route);
    assert.ok(result, `${route} missing from search index`);
    assert.equal(result?.status, route === "/lipi/runtime-status" ? "CONTROLLED_PREVIEW_NO_GO" : "CONTROLLED_NO_GO");
    assert.equal(result ? isNavigableSearchResult(result) : false, true);
  }

  const governance = searchUnifiedIndex("lipi production gate governance", {}, index).find((entry) => entry.path === "/lipi/governance");
  const release = searchUnifiedIndex("lipi rc bundle release", {}, index).find((entry) => entry.path === "/lipi/release");
  const runtime = searchUnifiedIndex("controlled preview runtime active read only", {}, index).find((entry) => entry.path === "/lipi/runtime-status");
  assert.equal(governance?.type, "route");
  assert.equal(release?.type, "route");
  assert.equal(runtime?.status, "CONTROLLED_PREVIEW_NO_GO");
});

test("Lipi Full script detail stays PHKD-gated and links to existing registry truth", () => {
  const detail = getLipiRegistryScript("unicode-devanagari");
  assert.equal(detail.ok, true);
  if (!detail.ok) return;

  assert.equal(detail.record.display_name, "Devanagari");
  assert.equal(detail.record.iso15924, "Deva");
  assert.equal(detail.record.hkd_runtime_enabled, false);
  assert.equal(detail.productionReady, false);
  assert.equal(detail.reviewState, "CONTROLLED_NO_GO");
});

test("application shell mounts Lipi Full routes without replacing the legacy registry", () => {
  const app = readFileSync("src/App.tsx", "utf8");
  const search = readFileSync("src/search/index.ts", "utf8");

  assert.match(app, /<LipiFullPage/);
  assert.match(app, /isLipiFullRoute\(route\)/);
  assert.match(app, /label: "Lipi Full"/);
  assert.match(app, /\/lipi-registry/);
  assert.match(search, /lipiFullWorkspaces/);
});
