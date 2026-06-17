import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const seed = readJson("data/hkd-lipi-script-registry-seed-426.json");
const report = readJson("data/iso15924-ingestion-report.json");
const crosswalk = readJson("data/iso15924-script-code-crosswalk.json");
const diffPreview = readJson("data/iso15924-diff-preview.json");
const blockers = readJson("data/iso15924-blockers.json");
const evidence = readJson("release/evidence/hkd-lipi-registry-phase9-iso15924-ingestion.json");
const officialIsoText = readFileSync("data/iso15924/iso15924.txt", "utf8");

const officialSourceId = "iso15924-official-plain-text";
const artifacts = [report, crosswalk, diffPreview, blockers, evidence];

test("Phase 9 ISO ingestion uses the official ISO plain-text snapshot only", () => {
  assert.match(officialIsoText, /Format:\s*\n#\s+Code;N°;English Name;Nom français;PVA;Unicode Version;Date/);
  assert.ok(officialIsoText.includes("Adlm;166;Adlam;adlam;Adlam;9.0;2016-12-05"));
  assert.ok(officialIsoText.includes("Zzzz;999;Code for uncoded script"));

  for (const artifact of artifacts) {
    assert.equal(artifact.officialSource.id, officialSourceId, artifact.schema);
    assert.equal(artifact.officialSource.url, "https://www.unicode.org/iso15924/iso15924.txt", artifact.schema);
    assert.equal(artifact.officialSource.sha256, sha256("data/iso15924/iso15924.txt"), artifact.schema);
    assert.ok(artifact.provenance?.sourceIds?.includes(officialSourceId), artifact.schema);
  }
  assert.equal(evidence.checks.officialIsoSourceOnly, true);
});

test("ISO crosswalk compares exactly the 176 Unicode script rows", () => {
  assert.equal(crosswalk.summary.unicodeScriptRowsCompared, 176);
  assert.equal(crosswalk.rows.length, 176);
  assert.equal(crosswalk.summary.officialIsoEntries, 226);
  assert.equal(crosswalk.summary.codeMatches, 176);
  assert.equal(crosswalk.summary.verifiedRows, 172);
  assert.equal(crosswalk.summary.blockedRows, 4);
  assert.equal(crosswalk.summary.conflictRows, 0);
  assert.equal(evidence.checks.comparedExactly176UnicodeRows, true);
  assert.equal(evidence.checks.everyUnicodeRowHasOfficialIsoCode, true);
});

test("missing or ambiguous ISO PVAs remain blocked", () => {
  const blockedRows = crosswalk.rows.filter((row) => row.status === "BLOCKED");
  const blockedValues = blockedRows.map((row) => row.unicodeScriptValue).sort();

  assert.deepEqual(blockedValues, ["Beria_Erfe", "Sidetic", "Tai_Yo", "Tolong_Siki"].sort());
  for (const row of blockedRows) {
    assert.equal(row.officialIso15924 !== "UNKNOWN", true, row.unicodeScriptValue);
    assert.equal(row.officialPva, "UNKNOWN", row.unicodeScriptValue);
    assert.equal(row.missingOrAmbiguousCode, true, row.unicodeScriptValue);
    assert.equal(row.blockers.includes("ISO_PVA_EMPTY_OR_AMBIGUOUS"), true, row.unicodeScriptValue);
  }

  assert.equal(blockers.summary.blockers, 4);
  assert.equal(blockers.summary.ambiguousOrMissingPvaRows, 4);
  assert.equal(blockers.summary.promotionBlocked, true);
  assert.equal(evidence.checks.missingOrAmbiguousCodesBlocked, true);
});

test("diff preview is preview-only and proposes no registry patch", () => {
  assert.equal(diffPreview.summary.diffs, 176);
  assert.equal(diffPreview.summary.proposedFieldChanges, 0);
  assert.equal(diffPreview.summary.previewOnlyRows, 176);
  assert.equal(diffPreview.summary.registryMutations, 0);
  assert.equal(diffPreview.summary.enrichedRows, 0);
  assert.equal(diffPreview.summary.runtimeEnablements, 0);

  for (const diff of diffPreview.diffs) {
    assert.equal(diff.previewOnly, true, diff.unicodeScriptValue);
    assert.equal(diff.proposedFieldChange, false, diff.unicodeScriptValue);
    assert.deepEqual(diff.proposedRegistryPatch, [], diff.unicodeScriptValue);
    assert.equal(diff.wouldMutateRegistry, false, diff.unicodeScriptValue);
    assert.equal(diff.wouldEnrichRow, false, diff.unicodeScriptValue);
    assert.equal(diff.wouldEnableRuntime, false, diff.unicodeScriptValue);
  }
  assert.equal(evidence.checks.previewOnlyDiffs, true);
});

test("report proves no mutation enrichment runtime enablement or production readiness", () => {
  assert.equal(report.ingestion.mode, "ISO15924_REAL_SOURCE_DRY_RUN_ONLY");
  assert.equal(report.ingestion.rowsWritten, 0);
  assert.equal(report.ingestion.enrichedRows, 0);
  assert.equal(report.ingestion.runtimeEnablements, 0);
  assert.equal(report.ingestion.proposedFieldChanges, 0);
  assert.equal(report.ingestion.seedHashBefore, sha256("data/hkd-lipi-script-registry-seed-426.json"));
  assert.equal(report.ingestion.seedHashAfter, report.ingestion.seedHashBefore);
  assert.equal(seed.records.every((record) => record.hkd_runtime_enabled === false), true);
  assert.equal(evidence.checks.noRegistryMutation, true);
  assert.equal(evidence.checks.noEnrichedRows, true);
  assert.equal(evidence.checks.noRuntimeEnablement, true);
  assert.equal(evidence.checks.noProductionReadyTrue, true);
});

test("conflict policy blocks promotion even though this ISO run found zero conflicts", () => {
  assert.equal(blockers.conflictPromotionPolicy.rule, "ANY_ISO15924_CONFLICT_BLOCKS_PROMOTION");
  assert.equal(blockers.conflictPromotionPolicy.promotionAllowedWhenConflict, false);
  assert.equal(blockers.conflictPromotionPolicy.enforced, true);
  assert.equal(blockers.conflictPromotionPolicy.conflictsDetected, 0);
  assert.equal(report.ingestion.conflictsBlockPromotion, true);
  assert.equal(evidence.checks.conflictsBlockPromotion, true);
});

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path, "utf8")).digest("hex");
}
