import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const seed = readJson("data/hkd-lipi-script-registry-seed-426.json");
const dryRunReport = readJson("data/hkd-lipi-ingestion-dry-run-report.json");
const fieldDiffPreview = readJson("data/hkd-lipi-ingestion-field-diff-preview.json");
const blockers = readJson("data/hkd-lipi-ingestion-blockers.json");
const evidence = readJson("release/evidence/hkd-lipi-registry-phase8-dry-run-ingestion.json");

const controlledNoGoArtifacts = [dryRunReport, fieldDiffPreview, blockers, evidence];

test("Phase 8 dry-run outputs remain controlled no-go with production and runtime disabled", () => {
  for (const artifact of controlledNoGoArtifacts) {
    assert.equal(artifact.reviewState, "CONTROLLED_NO_GO", artifact.schema);
    assert.equal(artifact.governedProductionGo, false, artifact.schema);
    assert.equal(artifact.productionReady, false, artifact.schema);
    assert.equal(artifact.runtimeEnabled, 0, artifact.schema);
    assert.equal(artifact.phkdVerdict, "CONTROLLED_NO_GO", artifact.schema);
    assert.ok(artifact.provenance?.sourceIds?.length > 0, artifact.schema);
  }

  assert.equal(evidence.checks.noProductionReadyTrue, true);
  assert.equal(seed.records.every((record) => record.hkd_runtime_enabled === false), true);
});

test("dry-run harness runs adapters without mutating registry rows", () => {
  assert.equal(dryRunReport.dryRun.mode, "DRY_RUN_ONLY");
  assert.equal(dryRunReport.dryRun.inputSeedRows, 426);
  assert.equal(dryRunReport.dryRun.adaptersRun, 5);
  assert.equal(dryRunReport.dryRun.rowsWritten, 0);
  assert.equal(dryRunReport.dryRun.enrichedRows, 0);
  assert.equal(dryRunReport.dryRun.runtimeEnabledRowsAfterPreview, 0);
  assert.equal(dryRunReport.dryRun.seedHashBefore, sha256("data/hkd-lipi-script-registry-seed-426.json"));
  assert.equal(dryRunReport.dryRun.seedHashAfter, dryRunReport.dryRun.seedHashBefore);
  assert.equal(dryRunReport.adapterRuns.every((run) => run.rowsWritten === 0 && run.enrichedRows === 0 && run.runtimeEnablements === 0), true);
  assert.equal(evidence.checks.noRegistryMutation, true);
  assert.equal(evidence.checks.noEnrichedRows, true);
  assert.equal(evidence.checks.noRuntimeEnablement, true);
});

test("field diff preview is preview-only and contains no registry value changes", () => {
  assert.equal(fieldDiffPreview.summary.previews, 20);
  assert.equal(fieldDiffPreview.summary.proposedFieldChanges, 0);
  assert.equal(fieldDiffPreview.summary.registryMutations, 0);
  assert.equal(fieldDiffPreview.summary.enrichedRows, 0);
  assert.equal(fieldDiffPreview.summary.runtimeEnablements, 0);
  assert.equal(fieldDiffPreview.summary.previewOnlyRows, fieldDiffPreview.summary.previews);

  for (const preview of fieldDiffPreview.previews) {
    assert.equal(preview.previewOnly, true, preview.id);
    assert.equal(preview.wouldMutateRegistry, false, preview.id);
    assert.equal(preview.wouldEnrichRow, false, preview.id);
    assert.equal(preview.wouldEnableRuntime, false, preview.id);
    assert.equal(preview.proposedFieldChange, false, preview.id);
    assert.equal(preview.proposedRegistryValue, "NO_REGISTRY_VALUE_PROPOSED", preview.id);
    assert.ok(preview.provenance?.sourceIds?.length > 0, preview.id);
  }
  assert.equal(evidence.checks.everyProposedFieldChangePreviewOnly, true);
});

test("blockers prevent promotion and conflicts are configured to block promotion", () => {
  assert.equal(blockers.summary.promotionBlocked, true);
  assert.equal(blockers.summary.blockers > 0, true);
  assert.equal(blockers.conflictPromotionPolicy.promotionAllowedWhenConflict, false);
  assert.equal(blockers.conflictPromotionPolicy.enforced, true);
  assert.equal(blockers.conflictPromotionPolicy.rule, "ANY_CONFLICT_BLOCKS_PROMOTION");
  assert.equal(dryRunReport.dryRun.promotionStatus, "BLOCKED");
  assert.equal(dryRunReport.dryRun.conflictsBlockPromotion, true);
  assert.equal(evidence.checks.conflictsBlockPromotion, true);
  assert.equal(evidence.checks.promotionBlocked, true);
});

test("blocked and unknown adapter fields produce blockers without write paths", () => {
  const fieldBlockers = blockers.blockers.filter((blocker) => blocker.id.startsWith("phase8:blocker:") && blocker.adapterId !== "dry-run-harness");
  assert.equal(fieldBlockers.length, 19);
  assert.equal(blockers.summary.fieldBlockers, 19);
  assert.equal(blockers.summary.blockedStatusBlockers, 19);
  assert.equal(blockers.summary.unknownStatusBlockers, 2);

  for (const blocker of blockers.blockers) {
    assert.equal(blocker.blocksPromotion, true, blocker.id);
    assert.ok(blocker.requiredToUnblock.length > 0, blocker.id);
    assert.ok(blocker.provenance?.sourceIds?.length > 0, blocker.id);
  }
});

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path, "utf8")).digest("hex");
}
