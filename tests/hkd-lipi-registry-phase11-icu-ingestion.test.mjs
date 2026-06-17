import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const seed = readJson("data/hkd-lipi-script-registry-seed-426.json");
const report = readJson("data/icu-ingestion-report.json");
const crosswalk = readJson("data/icu-script-metadata-crosswalk.json");
const diffPreview = readJson("data/icu-diff-preview.json");
const blockers = readJson("data/icu-blockers.json");
const evidence = readJson("release/evidence/hkd-lipi-registry-phase11-icu-ingestion.json");
const icuHeader = readFileSync("data/icu/uscript.h", "utf8");

const officialSourceId = "icu-official-uscript-source";
const artifacts = [report, crosswalk, diffPreview, blockers, evidence];

test("Phase 11 ICU dry ingestion uses the official pinned ICU UScript source only", () => {
  assert.match(icuHeader, /typedef enum UScriptCode/);
  assert.match(icuHeader, /USCRIPT_DEVANAGARI\s*=\s*10,\s*\/\* Deva \*\//);
  assert.match(icuHeader, /USCRIPT_CODE_LIMIT\s*=\s*213/);

  for (const artifact of artifacts) {
    assert.equal(artifact.officialSource.id, officialSourceId, artifact.schema);
    assert.equal(artifact.officialSource.commit, "f23381d83cdd98199247adafc85851ce9c2e143f", artifact.schema);
    assert.equal(artifact.officialSource.files[0].sha256, sha256("data/icu/uscript.h"), artifact.schema);
    assert.equal(artifact.officialSource.files[1].sha256, sha256("data/icu/uscript_props.cpp"), artifact.schema);
    assert.ok(artifact.provenance?.sourceIds?.includes(officialSourceId), artifact.schema);
  }
  assert.equal(evidence.checks.officialIcuSourceOnly, true);
});

test("ICU crosswalk compares exactly the 176 Unicode script rows", () => {
  assert.equal(crosswalk.summary.unicodeScriptRowsCompared, 176);
  assert.equal(crosswalk.rows.length, 176);
  assert.equal(crosswalk.summary.officialIcuScriptCodes, 213);
  assert.equal(crosswalk.summary.officialIcuAliasConstants, 6);
  assert.equal(crosswalk.summary.verifiedRows, 168);
  assert.equal(crosswalk.summary.unknownRows, 0);
  assert.equal(crosswalk.summary.blockedRows, 8);
  assert.equal(crosswalk.summary.extraIcuCodesNotInUcdRegistry, 37);
  assert.equal(evidence.checks.comparedExactly176UnicodeRows, true);
  assert.equal(evidence.checks.everyUnicodeRowHasIcuCode, true);
});

test("ICU row mismatches with UCD and ISO remain blocked", () => {
  const rowBlockers = blockers.blockers.filter((row) => row.blockerClass === "UCD_ROW_METADATA_MISMATCH");
  const canonicalNameRows = rowBlockers.filter((row) => row.blockers.includes("ICU_CONSTANT_NAME_DIFFERS_FROM_UCD_CANONICAL_VALUE"));
  const isoBlockedRows = rowBlockers.filter((row) => row.blockers.includes("ISO15924_ROW_BLOCKED"));

  assert.deepEqual(canonicalNameRows.map((row) => row.unicodeScriptValue).sort(), ["Meetei_Mayek", "Mende_Kikakui", "Old_Turkic", "Tai_Tham"].sort());
  assert.deepEqual(isoBlockedRows.map((row) => row.unicodeScriptValue).sort(), ["Beria_Erfe", "Sidetic", "Tai_Yo", "Tolong_Siki"].sort());
  assert.equal(blockers.summary.ucdRowMetadataMismatches, 8);
  assert.equal(blockers.summary.canonicalNameMismatches, 4);
  assert.equal(blockers.summary.isoBlockedRows, 4);

  for (const row of rowBlockers) {
    assert.equal(row.status, "BLOCKED", row.unicodeScriptValue);
    assert.equal(row.blocksPromotion, true, row.unicodeScriptValue);
    assert.ok(row.provenance?.sourceIds?.includes(officialSourceId), row.unicodeScriptValue);
  }
  assert.equal(evidence.checks.mismatchesBlocked, true);
});

test("ICU-only or language-tag script codes outside UCD remain blocked", () => {
  const extraBlockers = blockers.blockers.filter((row) => row.blockerClass === "ICU_EXTRA_NON_UCD_SCRIPT_CODE");
  const extraCodes = extraBlockers.map((row) => row.icuShortName).sort();

  assert.equal(extraBlockers.length, 37);
  assert.ok(extraCodes.includes("Hans"));
  assert.ok(extraCodes.includes("Hant"));
  assert.ok(extraCodes.includes("Jpan"));
  assert.ok(extraCodes.includes("Kore"));
  assert.ok(extraCodes.includes("Hntl"));
  for (const row of extraBlockers) {
    assert.equal(row.status, "BLOCKED", row.icuShortName);
    assert.equal(row.blocksPromotion, true, row.icuShortName);
    assert.equal(row.genealogyClaim, "NOT_ASSERTED", row.icuShortName);
    assert.equal(row.fontClaim, "NOT_ASSERTED", row.icuShortName);
    assert.equal(row.renderingClaim, "NOT_ASSERTED", row.icuShortName);
    assert.ok(row.provenance?.sourceIds?.includes(officialSourceId), row.icuShortName);
  }
});

test("ICU diff preview is preview-only and proposes no registry patch", () => {
  assert.equal(diffPreview.summary.diffs, 176);
  assert.equal(diffPreview.summary.metadataMatchPreviews, 168);
  assert.equal(diffPreview.summary.blockedMetadataPreviews, 8);
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

test("report proves no mutation enrichment runtime enablement production or unsupported claims", () => {
  assert.equal(report.ingestion.mode, "ICU_USCRIPT_METADATA_DRY_RUN_ONLY");
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
  assert.equal(evidence.checks.noLocaleInferenceClaims, true);
  assert.equal(evidence.checks.noGenealogyClaims, true);
  assert.equal(evidence.checks.noFontClaims, true);
  assert.equal(evidence.checks.noRenderingClaims, true);
});

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
