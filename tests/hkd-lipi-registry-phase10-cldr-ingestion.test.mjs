import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const seed = readJson("data/hkd-lipi-script-registry-seed-426.json");
const report = readJson("data/cldr-ingestion-report.json");
const crosswalk = readJson("data/cldr-script-locale-crosswalk.json");
const diffPreview = readJson("data/cldr-diff-preview.json");
const blockers = readJson("data/cldr-blockers.json");
const evidence = readJson("release/evidence/hkd-lipi-registry-phase10-cldr-ingestion.json");

const officialSourceId = "cldr-official-core-zip";
const officialSourcePath = "data/cldr/cldr-core.zip";
const artifacts = [report, crosswalk, diffPreview, blockers, evidence];

test("Phase 10 CLDR dry ingestion uses the official CLDR core snapshot only", () => {
  const officialSourceHash = sha256(officialSourcePath);

  for (const artifact of artifacts) {
    assert.equal(artifact.officialSource.id, officialSourceId, artifact.schema);
    assert.equal(artifact.officialSource.url, "https://unicode.org/Public/cldr/latest/core.zip", artifact.schema);
    assert.equal(artifact.officialSource.localPath, officialSourcePath, artifact.schema);
    assert.equal(artifact.officialSource.sha256, officialSourceHash, artifact.schema);
    assert.ok(artifact.provenance?.sourceIds?.includes(officialSourceId), artifact.schema);
  }
  assert.equal(evidence.checks.officialCldrSourceOnly, true);
});

test("CLDR crosswalk compares exactly the 176 Unicode script rows", () => {
  assert.equal(crosswalk.summary.unicodeScriptRowsCompared, 176);
  assert.equal(crosswalk.rows.length, 176);
  assert.equal(crosswalk.summary.cldrMainLocaleFiles, 1122);
  assert.equal(crosswalk.summary.explicitLocaleScriptLinks, 166);
  assert.equal(crosswalk.summary.cldrScriptCodesWithExplicitLinks, 22);
  assert.equal(crosswalk.summary.matchedRegistryScriptCodes, 20);
  assert.equal(crosswalk.summary.unmatchedCldrScriptCodes, 2);
  assert.equal(crosswalk.summary.verifiedRows, 20);
  assert.equal(crosswalk.summary.unknownRows, 156);
  assert.equal(crosswalk.summary.blockedRows, 0);
  assert.equal(evidence.checks.localeScriptLinksSourceBacked, true);
});

test("locale-script links are source backed and do not assert language usage genealogy or fonts", () => {
  const verifiedRows = crosswalk.rows.filter((row) => row.status === "VERIFIED");
  assert.equal(verifiedRows.length, 20);

  for (const row of verifiedRows) {
    assert.equal(row.sourceBacked, true, row.unicodeScriptValue);
    assert.equal(row.languageUsageClaim, "NOT_ASSERTED", row.unicodeScriptValue);
    assert.equal(row.genealogyClaim, "NOT_ASSERTED", row.unicodeScriptValue);
    assert.equal(row.fontClaim, "NOT_ASSERTED", row.unicodeScriptValue);
    assert.ok(row.localeLinks.length > 0, row.unicodeScriptValue);
    for (const link of row.localeLinks) {
      assert.equal(link.sourceBacked, true, link.localeId);
      assert.match(link.sourcePath, /^common\/main\/.+\.xml$/, link.localeId);
      assert.equal(link.relationType, "EXPLICIT_LDML_IDENTITY_SCRIPT", link.localeId);
      assert.equal(link.languageUsageClaim, "NOT_ASSERTED", link.localeId);
      assert.equal(link.genealogyClaim, "NOT_ASSERTED", link.localeId);
      assert.equal(link.fontClaim, "NOT_ASSERTED", link.localeId);
      assert.ok(link.provenance?.sourceIds?.includes(officialSourceId), link.localeId);
    }
  }

  assert.equal(evidence.checks.noInventedLanguageUsageClaims, true);
  assert.equal(evidence.checks.noGenealogyClaims, true);
  assert.equal(evidence.checks.noFontClaims, true);
});

test("Hans and Hant remain blocked instead of being merged into Han", () => {
  assert.deepEqual(crosswalk.unmatchedCldrScripts, ["Hans", "Hant"]);
  assert.equal(blockers.summary.blockers, 2);
  assert.equal(blockers.summary.ambiguousScriptLocaleRelations, 2);
  assert.equal(blockers.summary.promotionBlocked, true);

  for (const blocker of blockers.blockers) {
    assert.match(blocker.cldrScript, /^Han[st]$/);
    assert.equal(blocker.status, "BLOCKED", blocker.cldrScript);
    assert.equal(blocker.blocksPromotion, true, blocker.cldrScript);
    assert.ok(blocker.reason.includes("does not map to a Unicode Script property row"), blocker.cldrScript);
    assert.ok(blocker.localeLinks.length > 0, blocker.cldrScript);
    assert.ok(blocker.provenance?.sourceIds?.includes(officialSourceId), blocker.cldrScript);
  }
  assert.equal(evidence.checks.ambiguousRelationsBlocked, true);
});

test("CLDR diff preview is preview-only and proposes no registry patch", () => {
  assert.equal(diffPreview.summary.diffs, 176);
  assert.equal(diffPreview.summary.sourceBackedMetadataPreviews, 20);
  assert.equal(diffPreview.summary.noExplicitLinkPreviews, 156);
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
  assert.equal(report.ingestion.mode, "CLDR_LOCALE_SCRIPT_METADATA_DRY_RUN_ONLY");
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

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
