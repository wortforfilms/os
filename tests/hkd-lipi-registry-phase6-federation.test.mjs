import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sourceRegistry = readJson("data/hkd-lipi-federated-source-registry.json");
const lineage = readJson("data/hkd-lipi-evidence-lineage-graph.json");
const conflicts = readJson("data/hkd-lipi-source-conflict-detector.json");
const chains = readJson("data/hkd-lipi-provenance-chain-explorer.json");
const evidence = readJson("release/evidence/hkd-lipi-registry-phase6-federation.json");
const seed = readJson("data/hkd-lipi-script-registry-seed-426.json");

const requestedSources = ["unicode-ucd", "iso-15924", "cldr", "icu", "harfbuzz", "opentype-spec"];

test("Phase 6 source registry registers requested authorities without creating script claims", () => {
  const ids = new Set(sourceRegistry.sources.map((source) => source.id));
  for (const sourceId of requestedSources) assert.equal(ids.has(sourceId), true, sourceId);

  assert.equal(sourceRegistry.summary.sources, 7);
  assert.equal(sourceRegistry.summary.createsNewScriptClaims, 0);
  assert.equal(sourceRegistry.sources.every((source) => source.createsNewScriptClaims === false), true);
  assert.equal(sourceRegistry.sources.find((source) => source.id === "unicode-ucd")?.localStatus, "LOCAL_INGESTED");
  assert.equal(sourceRegistry.sources.find((source) => source.id === "iso-15924")?.localStatus, "PARTIAL_VIA_UCD_PROPERTY_VALUE_ALIASES");
});

test("CLDR ICU HarfBuzz and OpenType remain blocked until local snapshots are ingested", () => {
  for (const sourceId of ["cldr", "icu", "harfbuzz", "opentype-spec"]) {
    const source = sourceRegistry.sources.find((entry) => entry.id === sourceId);
    assert.equal(source?.localStatus, "NOT_INGESTED", sourceId);
    assert.deepEqual(source?.localArtifacts, [], sourceId);
    assert.equal(source?.createsNewScriptClaims, false, sourceId);
    assert.equal(conflicts.blockedComparisons.some((comparison) => comparison.sourceId === sourceId && comparison.compared === false), true, sourceId);
  }
  assert.equal(conflicts.checks.cldrIcuHarfBuzzOpenTypeBlockedUntilIngested, true);
});

test("evidence lineage graph has no claim-creating edges", () => {
  assert.equal(lineage.summary.claimCreatingEdges, 0);
  assert.equal(lineage.edges.every((edge) => edge.fields.createsNewScriptClaims !== true), true);
  assert.equal(lineage.nodes.every((node) => node.provenance?.sourceIds?.length > 0), true);
  assert.equal(lineage.edges.every((edge) => edge.provenance?.sourceIds?.length > 0), true);
});

test("source conflict detector reports zero conflicts and all graph refs registered", () => {
  assert.equal(conflicts.summary.conflicts, 0);
  assert.equal(conflicts.summary.highSeverityConflicts, 0);
  assert.equal(conflicts.summary.newScriptClaimsCreated, 0);
  assert.equal(conflicts.checks.noSeedCrosswalkAliasMismatches, true);
  assert.equal(conflicts.checks.everyGraphSourceRefRegistered, true);
  assert.equal(conflicts.localComparisons.every((comparison) => comparison.mismatches.length === 0), true);
});

test("provenance chain explorer covers all 426 scripts without orphan chains", () => {
  assert.equal(chains.summary.scriptChains, 426);
  assert.equal(chains.summary.completeScriptChains, 426);
  assert.equal(chains.summary.orphanScriptChains, 0);
  assert.equal(chains.scriptChains.length, seed.records.length);
  assert.equal(chains.scriptChains.every((chain) => chain.sourceChainStatus === "COMPLETE"), true);
});

test("Phase 6 evidence remains controlled no-go with runtime and production disabled", () => {
  assert.equal(evidence.reviewState, "CONTROLLED_NO_GO");
  assert.equal(evidence.governedProductionGo, false);
  assert.equal(evidence.productionReady, false);
  assert.equal(evidence.runtimeEnabled, 0);
  assert.equal(evidence.phkdVerdict, "CONTROLLED_NO_GO");
  assert.equal(evidence.checks.requestedSourcesRegistered, true);
  assert.equal(evidence.checks.noNewScriptClaimsCreated, true);
  assert.equal(evidence.checks.noRuntimeEnabledTrue, true);
  assert.equal(evidence.checks.noProductionReadyTrue, true);
  assert.equal(seed.records.every((record) => record.hkd_runtime_enabled === false), true);
});

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
