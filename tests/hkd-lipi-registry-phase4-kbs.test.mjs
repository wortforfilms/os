import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const seed = readJson("data/hkd-lipi-script-registry-seed-426.json");
const numeral = readJson("data/hkd-lipi-numeral-registry.json");
const crosswalk = readJson("data/hkd-lipi-unicode-crosswalk.json");
const nodes = readJson("data/hkd-lipi-kbs-nodes.json");
const edges = readJson("data/hkd-lipi-kbs-edges.json");
const graph = readJson("data/hkd-lipi-kbs-graph.json");
const evidence = readJson("release/evidence/hkd-lipi-registry-phase4-kbs.json");

const graphNodes = graph.nodes;
const graphEdges = graph.edges;
const nodeIds = new Set(graphNodes.map((node) => node.id));
const scriptNodes = graphNodes.filter((node) => node.type === "Script");
const unicodeRows = seed.records.filter((record) => record.registry_class === "unicode");
const decimalScriptValues = new Set(numeral.records.map((record) => record.scriptValue));

test("Phase 4 KBS graph contains exactly 426 script nodes", () => {
  assert.equal(nodes.summary.byType.Script, 426);
  assert.equal(graph.summary.scriptNodes, 426);
  assert.equal(scriptNodes.length, 426);
  assert.deepEqual(
    new Set(scriptNodes.map((node) => node.fields.registry_id)),
    new Set(seed.records.map((record) => record.id)),
  );
});

test("every Unicode script row has evidence edge", () => {
  for (const record of unicodeRows) {
    assert.equal(
      graphEdges.some((edge) => edge.type === "SCRIPT_BACKED_BY_EVIDENCE" && edge.from === record.kbs_node_id),
      true,
      record.id,
    );
  }
});

test("every decimal digit group has zero glyph edge", () => {
  for (const record of seed.records.filter((candidate) => decimalScriptValues.has(candidate.unicode_script_value))) {
    assert.equal(
      graphEdges.some((edge) => edge.type === "SCRIPT_HAS_ZERO_GLYPH" && edge.from === record.kbs_node_id),
      true,
      record.id,
    );
  }
});

test("nodes and edges all carry provenance and valid endpoints", () => {
  assert.equal(graphNodes.every((node) => node.provenance?.sourceIds?.length > 0), true);
  assert.equal(graphEdges.every((edge) => edge.provenance?.sourceIds?.length > 0), true);
  assert.equal(edges.edges.every((edge) => edge.provenance?.sourceIds?.length > 0), true);
  assert.equal(graphEdges.every((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)), true);
});

test("no runtime is enabled and production readiness remains false", () => {
  assert.equal(seed.records.every((record) => record.hkd_runtime_enabled === false), true);
  assert.equal(scriptNodes.every((node) => node.fields.runtime_enabled === false), true);
  assert.equal(graphEdges.every((edge) => edge.fields?.runtime_enabled !== true), true);
  assert.equal(graph.runtimeEnabled, 0);
  assert.equal(graph.productionReady, false);
  assert.equal(graph.governedProductionGo, false);
  assert.equal(graph.phkdVerdict, "CONTROLLED_NO_GO");
  assert.equal(evidence.runtimeEnabled, 0);
  assert.equal(evidence.productionReady, false);
  assert.equal(evidence.governedProductionGo, false);
});

test("Phase 4 does not infer blocked domains outside trusted inputs", () => {
  assert.equal(graphEdges.some((edge) => edge.type.includes("GENEALOGICAL") || edge.type.includes("DESCENT")), false);
  assert.equal(crosswalk.records.every((record) => record.fontSupportMetadata.status === "UNKNOWN"), true);
  assert.equal(crosswalk.records.every((record) => record.transliterationMetadata.status === "UNKNOWN" && record.transliterationMetadata.systems.length === 0), true);
  assert.equal(evidence.checks.noGenealogicalDescentEdges, true);
  assert.equal(evidence.checks.noFontSupportInvented, true);
  assert.equal(evidence.checks.noTransliterationMappingsInvented, true);
});

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
