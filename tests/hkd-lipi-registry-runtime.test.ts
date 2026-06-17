import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  getLipiKbsGraphView,
  getLipiNumeralZeroView,
  getLipiRegistryRecords,
  getLipiRegistryScript,
  getLipiRegistrySourceSummary,
  getLipiScriptKbsNeighborhood,
  getLipiUnicodeCrosswalk,
  listLipiRegistryScripts,
} from "../src/lipi-registry/api.ts";
import { isNavigableSearchResult, searchUnifiedIndex } from "../src/search/index.ts";

test("Phase 2 registry API exposes the 426 seed without production-ready rows", () => {
  const records = getLipiRegistryRecords();
  const list = listLipiRegistryScripts({ limit: 426 });

  assert.equal(records.length, 426);
  assert.equal(list.total, 426);
  assert.equal(list.returned, 426);
  assert.equal(list.reviewState, "CONTROLLED_NO_GO");
  assert.equal(list.governedProductionGo, false);
  assert.equal(list.productionReady, false);
  assert.equal(list.stats.runtimeEnabled, 0);
  assert.equal(records.every((record) => record.hkd_runtime_enabled === false), true);
});

test("Unicode crosswalk is sourced from Unicode rows and does not invent ISO aliases", () => {
  const crosswalk = getLipiUnicodeCrosswalk();
  const unicodeRecords = getLipiRegistryRecords().filter((record) => record.registry_class === "unicode");

  assert.equal(crosswalk.total, unicodeRecords.length);
  assert.equal(crosswalk.total, 176);
  for (const row of crosswalk.rows) {
    assert.notEqual(row.unicodeScriptValue, "UNKNOWN");
    assert.equal(row.iso15924, row.unicodeScriptAlias);
    assert.ok(row.id.startsWith("unicode-"));
    assert.ok(Array.isArray(row.unicodeBlocks));
    assert.ok(row.fontSupportStatus === "UNKNOWN");
    assert.ok(row.transliterationStatus === "UNKNOWN");
  }
});

test("non-Unicode and HKD private rows fail closed on Unicode and ISO fields", () => {
  const nonUnicodeRows = getLipiRegistryRecords().filter((record) => record.registry_class !== "unicode");
  assert.ok(nonUnicodeRows.length > 0);

  for (const row of nonUnicodeRows) {
    assert.equal(row.unicode_script_value, "UNKNOWN", row.id);
    assert.equal(row.unicode_script_alias, "UNKNOWN", row.id);
    assert.equal(row.iso15924, "UNKNOWN", row.id);
    assert.equal(row.hkd_runtime_enabled, false, row.id);
  }
});

test("script detail API returns evidence badges and local contracts", () => {
  const detail = getLipiRegistryScript("unicode-devanagari");
  assert.equal(detail.ok, true);
  if (!detail.ok) return;

  assert.equal(detail.record.display_name, "Devanagari");
  assert.equal(detail.governedProductionGo, false);
  assert.equal(detail.productionReady, false);
  assert.ok(detail.badges.some((badge) => badge.label === "Runtime" && badge.value === "DISABLED"));
  assert.ok(detail.badges.some((badge) => badge.label === "ISO 15924" && badge.value === "Deva"));
  assert.ok(detail.apiLinks.some((link) => link.path === "/api/lipi-registry/scripts/unicode-devanagari"));
});

test("numeral and zero view exposes UCD decimal enrichment without enabling runtime", () => {
  const numeralView = getLipiNumeralZeroView();

  assert.equal(numeralView.summary.total, 63);
  assert.equal(numeralView.summary.rowsWithKnownZeroGlyph, 63);
  assert.equal(numeralView.summary.rowsWithDigitInventory, 63);
  assert.equal(numeralView.summary.rowsWithDecimalDigitsTrue, 63);
  assert.equal(numeralView.summary.rowsStillUnknown, 0);
  assert.ok(numeralView.rows.find((row) => row.displayName === "Devanagari" && row.zeroCodePoint === "U+0966" && row.digits.length === 10));
  assert.equal(numeralView.governedProductionGo, false);
  assert.equal(numeralView.productionReady, false);
});

test("unified search exposes Lipi details as controlled no-go navigable registry pages", () => {
  const results = searchUnifiedIndex("devanagari lipi");
  const result = results.find((entry) => entry.id === "lipi:unicode-devanagari");

  assert.ok(result);
  assert.equal(result.type, "lipi");
  assert.equal(result.status, "CONTROLLED_NO_GO");
  assert.equal(result.path, "/lipi-registry/unicode-devanagari");
  assert.equal(isNavigableSearchResult(result), true);
});

test("source summary carries local API contracts and keeps production blocked", () => {
  const sourceSummary = getLipiRegistrySourceSummary();

  assert.equal(sourceSummary.reviewState, "CONTROLLED_NO_GO");
  assert.equal(sourceSummary.governedProductionGo, false);
  assert.equal(sourceSummary.productionReady, false);
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/numerals-zero"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/phase3/family-graph"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/kbs/graph"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/scripts/{id}/kbs"));
  assert.equal(sourceSummary.phase3SourcePolicy, "official_unicode_ucd_only");
  assert.equal(sourceSummary.phase4SourcePolicy, "hkd_registry_seed_plus_phase3_ucd_artifacts_only");
  assert.ok(sourceSummary.sourceRefs.length >= 5);
});

test("Phase 4 KBS graph API exposes evidence graph without enabling runtime", () => {
  const graph = getLipiKbsGraphView();
  const detail = getLipiScriptKbsNeighborhood("unicode-devanagari");

  assert.equal(graph.summary.scriptNodes, 426);
  assert.equal(graph.summary.nodeTypes.Script, 426);
  assert.equal(graph.summary.edgeTypes.SCRIPT_BACKED_BY_EVIDENCE > 0, true);
  assert.equal(graph.summary.edgeTypes.SCRIPT_HAS_ZERO_GLYPH, 63);
  assert.equal(graph.productionReady, false);
  assert.equal(graph.governedProductionGo, false);
  assert.equal(graph.phkdVerdict, "CONTROLLED_NO_GO");
  assert.equal(graph.summary.runtimeEnabledRows, 0);
  assert.ok(graph.summary.blockedFields.some((field) => field.field === "font_support_status" && field.status === "UNKNOWN"));
  assert.ok(graph.summary.blockedFields.some((field) => field.field === "genealogical_family_descent" && field.status === "BLOCKED"));

  assert.ok(detail);
  assert.equal(detail?.productionReady, false);
  assert.equal(detail?.record.id, "unicode-devanagari");
  assert.ok(detail?.edges.some((edge) => edge.type === "SCRIPT_HAS_UNICODE_VALUE"));
  assert.ok(detail?.edges.some((edge) => edge.type === "SCRIPT_HAS_DECIMAL_DIGITS"));
  assert.ok(detail?.edges.some((edge) => edge.type === "SCRIPT_HAS_ZERO_GLYPH"));
});

test("Phase 2 evidence artifact records the runtime integration without production claims", () => {
  assert.equal(existsSync("release/evidence/hkd-lipi-registry-phase2-runtime.json"), true);
  const evidence = JSON.parse(readFileSync("release/evidence/hkd-lipi-registry-phase2-runtime.json", "utf8"));

  assert.equal(evidence.reviewState, "CONTROLLED_NO_GO");
  assert.equal(evidence.governedProductionGo, false);
  assert.equal(evidence.productionReady, false);
  assert.equal(evidence.counts.records, 426);
  assert.equal(evidence.phkdChecks.everyRecordHasProvenance, true);
  assert.equal(evidence.phkdChecks.noProductionReadyRows, true);
  assert.equal(evidence.phkdChecks.noInventedNonUnicodeAssignments, true);
  assert.ok(evidence.runtimeIntegration.uiRoutes.includes("/lipi-registry/{id}"));
});
