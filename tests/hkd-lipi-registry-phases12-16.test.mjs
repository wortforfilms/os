import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const paths = {
  seed: "data/hkd-lipi-script-registry-seed-426.json",
  phase12Report: "data/hkd-lipi-harfbuzz-opentype-dry-ingestion-report.json",
  phase12Diff: "data/hkd-lipi-harfbuzz-opentype-diff-preview.json",
  phase12Blockers: "data/hkd-lipi-harfbuzz-opentype-blockers.json",
  phase12Evidence: "release/evidence/hkd-lipi-registry-phase12-harfbuzz-opentype.json",
  phase13Audit: "data/hkd-lipi-cross-source-conflict-authority-audit.json",
  phase13Evidence: "release/evidence/hkd-lipi-registry-phase13-authority-audit.json",
  phase14Proposals: "data/hkd-lipi-controlled-enrichment-proposals.json",
  phase14Evidence: "release/evidence/hkd-lipi-registry-phase14-controlled-enrichment.json",
  phase15Gate: "data/hkd-lipi-runtime-enablement-gate-review.json",
  phase15Evidence: "release/evidence/hkd-lipi-registry-phase15-runtime-gate-review.json",
  phase16Index: "data/hkd-lipi-release-candidate-evidence-index.json",
  phase16Bundle: "release/evidence/hkd-lipi-registry-phase16-release-candidate-evidence-bundle.json",
};

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

test("Phase 12 HarfBuzz/OpenType dry ingestion blocks all shaping and font claims", () => {
  const report = readJson(paths.phase12Report);
  const diff = readJson(paths.phase12Diff);
  const blockers = readJson(paths.phase12Blockers);
  const evidence = readJson(paths.phase12Evidence);

  assert.equal(report.reviewState, "CONTROLLED_NO_GO");
  assert.equal(report.productionReady, false);
  assert.equal(report.runtimeEnabled, 0);
  assert.equal(report.ingestion.mode, "HARFBUZZ_OPENTYPE_DRY_RUN_ONLY");
  assert.equal(report.ingestion.rowsWritten, 0);
  assert.equal(report.ingestion.enrichedRows, 0);
  assert.equal(report.ingestion.runtimeEnablements, 0);
  assert.equal(report.ingestion.seedHashBefore, report.ingestion.seedHashAfter);
  assert.equal(diff.summary.proposedFieldChanges, 0);
  assert.equal(diff.summary.registryMutations, 0);
  assert.equal(diff.summary.fontSupportClaimsAsserted, 0);
  assert.equal(diff.summary.shapingClaimsAsserted, 0);
  assert.equal(diff.summary.opentypeFeatureClaimsAsserted, 0);
  assert.equal(diff.diffs.every((row) => row.previewOnly && row.wouldMutateRegistry === false), true);
  assert.equal(blockers.summary.blockers, 10);
  assert.equal(blockers.summary.promotionBlocked, true);
  assert.equal(blockers.blockers.every((blocker) => blocker.provenance), true);
  assert.equal(evidence.checks.noFontSupportClaims, true);
  assert.equal(evidence.checks.noShapingClaims, true);
});

test("Phase 13 authority audit blocks promotion without auto-resolution", () => {
  const audit = readJson(paths.phase13Audit);
  const evidence = readJson(paths.phase13Evidence);

  assert.equal(audit.reviewState, "CONTROLLED_NO_GO");
  assert.equal(audit.productionReady, false);
  assert.equal(audit.runtimeEnabled, 0);
  assert.equal(audit.summary.sourcesAudited, 5);
  assert.equal(audit.summary.blockingFindings, 61);
  assert.equal(audit.summary.conflictsDetected, 0);
  assert.equal(audit.summary.autoResolvedConflicts, 0);
  assert.equal(audit.summary.registryMutations, 0);
  assert.equal(audit.summary.runtimeEnablements, 0);
  assert.equal(audit.conflictPolicy.autoResolveAllowed, false);
  assert.equal(audit.blockingFindings.every((finding) => finding.provenance && finding.blocksPromotion === true), true);
  assert.equal(evidence.checks.noAutoResolution, true);
  assert.equal(evidence.checks.promotionBlockedWhenFindingsExist, true);
});

test("Phase 14 enrichment engine emits proposal-only work items", () => {
  const proposals = readJson(paths.phase14Proposals);
  const evidence = readJson(paths.phase14Evidence);

  assert.equal(proposals.reviewState, "CONTROLLED_NO_GO");
  assert.equal(proposals.productionReady, false);
  assert.equal(proposals.runtimeEnabled, 0);
  assert.equal(proposals.summary.proposals, 6);
  assert.equal(proposals.summary.autoApply, 0);
  assert.equal(proposals.summary.registryMutations, 0);
  assert.equal(proposals.summary.runtimeEnablements, 0);
  assert.equal(proposals.proposals.every((proposal) => proposal.proposalStatus === "PROPOSAL_ONLY"), true);
  assert.equal(proposals.proposals.every((proposal) => proposal.autoApply === false), true);
  assert.equal(proposals.proposals.every((proposal) => proposal.requiresReview === true), true);
  assert.equal(proposals.proposals.every((proposal) => proposal.provenance), true);
  assert.equal(evidence.checks.proposalsOnly, true);
  assert.equal(evidence.checks.noAutoApply, true);
});

test("Phase 15 runtime enablement gate remains blocked", () => {
  const gate = readJson(paths.phase15Gate);
  const evidence = readJson(paths.phase15Evidence);

  assert.equal(gate.reviewState, "CONTROLLED_NO_GO");
  assert.equal(gate.productionReady, false);
  assert.equal(gate.runtimeEnabled, 0);
  assert.equal(gate.summary.gateStatus, "BLOCKED");
  assert.equal(gate.summary.runtimeEnablementApproved, false);
  assert.equal(gate.summary.runtimeEnabledRows, 0);
  assert.equal(gate.summary.unresolvedBlockers, 77);
  assert.equal(gate.summary.failedCriteria, 4);
  assert.equal(gate.summary.registryMutations, 0);
  assert.equal(gate.summary.runtimeEnablements, 0);
  assert.equal(gate.criteria.some((criterion) => criterion.id === "phase15:criterion:harfbuzz-opentype-fixtures" && criterion.status === "FAIL"), true);
  assert.equal(gate.blockers.every((blocker) => blocker.provenance && blocker.blocksRuntimeEnablement), true);
  assert.equal(evidence.checks.runtimeEnablementApprovedFalse, true);
  assert.equal(evidence.checks.blockedWhenUnresolvedBlockersExist, true);
});

test("Phase 16 evidence bundle is reproducible and does not claim release readiness", () => {
  const index = readJson(paths.phase16Index);
  const bundle = readJson(paths.phase16Bundle);
  const before = Object.values(paths).map((path) => [path, sha256(path)]);

  assert.equal(index.summary.releaseCandidate, false);
  assert.equal(index.summary.productionReady, false);
  assert.equal(index.summary.runtimeEnabled, 0);
  assert.equal(index.summary.missingArtifacts, 0);
  assert.equal(index.artifacts.every((artifact) => artifact.exists && artifact.sha256 !== "MISSING" && artifact.provenance), true);
  assert.equal(bundle.summary.releaseCandidate, false);
  assert.equal(bundle.summary.productionReady, false);
  assert.equal(bundle.summary.runtimeEnabled, 0);
  assert.equal(bundle.checks.everyIndexedArtifactExists, true);
  assert.equal(bundle.checks.releaseCandidateFalse, true);
  assert.equal(bundle.checks.productionReadyFalse, true);
  assert.equal(bundle.checks.runtimeEnabledZero, true);

  const rerun = spawnSync("node", ["scripts/generate-hkd-lipi-registry-phases12-16.mjs"], { encoding: "utf8" });
  assert.equal(rerun.status, 0, rerun.stderr);
  const after = Object.values(paths).map((path) => [path, sha256(path)]);
  assert.deepEqual(after, before);
});

test("Phase 12-16 artifacts exist and keep the 426-row seed immutable", () => {
  for (const path of Object.values(paths)) {
    assert.equal(existsSync(path), true, path);
  }
  const seed = readJson(paths.seed);
  assert.equal(seed.records.length, 426);
  assert.equal(seed.records.every((record) => record.hkd_runtime_enabled === false), true);
});
