import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  getLipiCldrIngestionView,
  getLipiEvidenceFederationView,
  getLipiIcuIngestionView,
  getLipiIngestionDryRunView,
  getLipiIso15924IngestionView,
  getLipiKbsGraphView,
  getLipiNumeralZeroView,
  getLipiPhase12To16GovernanceView,
  getLipiPhase17To19GovernanceView,
  getLipiRegistryAuditabilityView,
  getLipiRegistryRecords,
  getLipiRegistryScript,
  getLipiRegistrySourceSummary,
  getLipiScriptKbsNeighborhood,
  getLipiSourceIngestionContractsView,
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
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/export-center"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/audit"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/provenance"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/validator"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/diff"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/federation/sources"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/federation/lineage"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/federation/conflicts"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/federation/provenance-chains"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/ingestion/contracts"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/ingestion/policy"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/ingestion/trust-matrix"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/ingestion/conflict-rules"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/ingestion/dry-run"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/ingestion/field-diff-preview"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/ingestion/blockers"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/ingestion/iso15924/report"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/ingestion/iso15924/crosswalk"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/ingestion/iso15924/diff-preview"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/ingestion/iso15924/blockers"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/ingestion/cldr/report"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/ingestion/cldr/crosswalk"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/ingestion/cldr/diff-preview"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/ingestion/cldr/blockers"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/ingestion/icu/report"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/ingestion/icu/crosswalk"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/ingestion/icu/diff-preview"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/ingestion/icu/blockers"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/ingestion/harfbuzz-opentype/report"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/ingestion/harfbuzz-opentype/diff-preview"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/ingestion/harfbuzz-opentype/blockers"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/conflict-authority-audit"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/controlled-enrichment/proposals"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/runtime-enablement/gate-review"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/release-candidate/evidence-bundle"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/operator/runbook"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/external-review/package"));
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/production-go/approval-gate"));
  assert.equal(sourceSummary.phase3SourcePolicy, "official_unicode_ucd_only");
  assert.equal(sourceSummary.phase4SourcePolicy, "hkd_registry_seed_plus_phase3_ucd_artifacts_only");
  assert.equal(sourceSummary.phase6SourcePolicy, "cross_reference_only_no_new_script_claims");
  assert.equal(sourceSummary.phase7SourcePolicy, "adapter_contracts_only_no_ingestion_no_silent_enrichment");
  assert.equal(sourceSummary.phase8SourcePolicy, "dry_run_only_no_registry_mutation_no_enrichment");
  assert.equal(sourceSummary.phase9SourcePolicy, "iso15924_official_source_only_preview_no_registry_mutation");
  assert.equal(sourceSummary.phase10SourcePolicy, "cldr_official_source_only_locale_script_metadata_no_registry_mutation");
  assert.equal(sourceSummary.phase11SourcePolicy, "icu_official_uscript_source_only_script_metadata_no_registry_mutation");
  assert.equal(sourceSummary.phase12SourcePolicy, "harfbuzz_opentype_dry_run_blocked_without_fixtures_no_registry_mutation");
  assert.equal(sourceSummary.phase13SourcePolicy, "cross_source_conflict_authority_audit_no_auto_resolution");
  assert.equal(sourceSummary.phase14SourcePolicy, "controlled_enrichment_proposal_only_no_auto_apply");
  assert.equal(sourceSummary.phase15SourcePolicy, "runtime_enablement_gate_review_no_runtime_enablement");
  assert.equal(sourceSummary.phase16SourcePolicy, "release_candidate_evidence_bundle_no_release_candidate_go");
  assert.equal(sourceSummary.phase17SourcePolicy, "operator_runbook_docs_only_no_registry_mutation");
  assert.equal(sourceSummary.phase18SourcePolicy, "external_review_package_pending_no_approval_claim");
  assert.equal(sourceSummary.phase19SourcePolicy, "production_go_only_after_human_approval_and_zero_blockers");
  assert.ok(sourceSummary.sourceRefs.length >= 5);
});

test("Phase 6 federation API registers sources without creating claims", () => {
  const federation = getLipiEvidenceFederationView();

  assert.equal(federation.reviewState, "CONTROLLED_NO_GO");
  assert.equal(federation.productionReady, false);
  assert.equal(federation.governedProductionGo, false);
  assert.equal(federation.sourceRegistry.summary.sources, 7);
  assert.equal(federation.sourceRegistry.summary.createsNewScriptClaims, 0);
  assert.equal(federation.conflictDetector.summary.conflicts, 0);
  assert.equal(federation.conflictDetector.summary.blockedComparisons, 4);
  assert.equal(federation.conflictDetector.checks.noLineageClaimCreatingEdges, true);
  assert.equal(federation.conflictDetector.checks.everyGraphSourceRefRegistered, true);
  assert.equal(federation.provenanceChains.summary.scriptChains, 426);
  assert.equal(federation.provenanceChains.summary.orphanScriptChains, 0);
  assert.equal(federation.evidence.checks.noNewScriptClaimsCreated, true);
});

test("Phase 7 ingestion contracts API is validate-only and cannot enrich rows", () => {
  const ingestion = getLipiSourceIngestionContractsView();
  const adapterSourceIds = ingestion.adapterContracts.adapters.map((adapter) => adapter.sourceId).sort();

  assert.deepEqual(adapterSourceIds, ["cldr", "harfbuzz", "icu", "iso-15924", "opentype-spec"]);
  assert.equal(ingestion.reviewState, "CONTROLLED_NO_GO");
  assert.equal(ingestion.productionReady, false);
  assert.equal(ingestion.governedProductionGo, false);
  assert.equal(ingestion.phkdVerdict, "CONTROLLED_NO_GO");
  assert.equal(ingestion.adapterContracts.summary.validateOnlyAdapters, 5);
  assert.equal(ingestion.adapterContracts.summary.writesRegistryAdapters, 0);
  assert.equal(ingestion.adapterContracts.summary.silentEnrichmentAdapters, 0);
  assert.equal(ingestion.ingestionPolicy.adapterMode, "VALIDATE_ONLY");
  assert.equal(ingestion.ingestionPolicy.forbiddenActions.includes("invent_unicode_assignment"), true);
  assert.equal(ingestion.ingestionPolicy.forbiddenActions.includes("invent_iso15924_code"), true);
  assert.equal(ingestion.trustMatrix.summary.writesRegistryRows, 0);
  assert.equal(ingestion.trustMatrix.summary.silentEnrichmentRows, 0);
  assert.equal(ingestion.conflictRules.summary.autoApplyRules, 0);
  assert.equal(ingestion.conflictRules.summary.registryMutationRules, 0);
  assert.equal(ingestion.evidence.checks.noSilentEnrichment, true);
  assert.equal(ingestion.evidence.checks.noAdaptersWriteRegistry, true);
  assert.equal(ingestion.evidence.checks.onlyAllowedFieldStatuses, true);
});

test("Phase 8 dry-run API exposes previews without mutation or enrichment", () => {
  const dryRun = getLipiIngestionDryRunView();

  assert.equal(dryRun.reviewState, "CONTROLLED_NO_GO");
  assert.equal(dryRun.productionReady, false);
  assert.equal(dryRun.governedProductionGo, false);
  assert.equal(dryRun.dryRunReport.dryRun.mode, "DRY_RUN_ONLY");
  assert.equal(dryRun.dryRunReport.dryRun.rowsWritten, 0);
  assert.equal(dryRun.dryRunReport.dryRun.enrichedRows, 0);
  assert.equal(dryRun.dryRunReport.dryRun.runtimeEnabledRowsAfterPreview, 0);
  assert.equal(dryRun.fieldDiffPreview.summary.proposedFieldChanges, 0);
  assert.equal(dryRun.fieldDiffPreview.summary.registryMutations, 0);
  assert.equal(dryRun.blockers.summary.promotionBlocked, true);
  assert.equal(dryRun.evidence.checks.noRegistryMutation, true);
  assert.equal(dryRun.evidence.checks.everyProposedFieldChangePreviewOnly, true);
});

test("Phase 9 ISO 15924 API compares official source without registry mutation", () => {
  const iso = getLipiIso15924IngestionView();

  assert.equal(iso.reviewState, "CONTROLLED_NO_GO");
  assert.equal(iso.productionReady, false);
  assert.equal(iso.governedProductionGo, false);
  assert.equal(iso.report.officialSource.id, "iso15924-official-plain-text");
  assert.equal(iso.report.ingestion.mode, "ISO15924_REAL_SOURCE_DRY_RUN_ONLY");
  assert.equal(iso.report.ingestion.rowsWritten, 0);
  assert.equal(iso.report.ingestion.enrichedRows, 0);
  assert.equal(iso.report.ingestion.runtimeEnablements, 0);
  assert.equal(iso.crosswalk.summary.unicodeScriptRowsCompared, 176);
  assert.equal(iso.crosswalk.summary.verifiedRows, 172);
  assert.equal(iso.crosswalk.summary.blockedRows, 4);
  assert.equal(iso.diffPreview.summary.proposedFieldChanges, 0);
  assert.equal(iso.diffPreview.summary.registryMutations, 0);
  assert.equal(iso.blockers.summary.blockers, 4);
  assert.equal(iso.blockers.summary.promotionBlocked, true);
  assert.equal(iso.evidence.checks.officialIsoSourceOnly, true);
  assert.equal(iso.evidence.checks.missingOrAmbiguousCodesBlocked, true);
  assert.equal(iso.evidence.checks.noRegistryMutation, true);
});

test("Phase 10 CLDR API exposes locale-script metadata dry-run without registry mutation", () => {
  const cldr = getLipiCldrIngestionView();

  assert.equal(cldr.reviewState, "CONTROLLED_NO_GO");
  assert.equal(cldr.productionReady, false);
  assert.equal(cldr.governedProductionGo, false);
  assert.equal(cldr.report.officialSource.id, "cldr-official-core-zip");
  assert.equal(cldr.report.ingestion.mode, "CLDR_LOCALE_SCRIPT_METADATA_DRY_RUN_ONLY");
  assert.equal(cldr.report.ingestion.rowsWritten, 0);
  assert.equal(cldr.report.ingestion.enrichedRows, 0);
  assert.equal(cldr.report.ingestion.runtimeEnablements, 0);
  assert.equal(cldr.report.ingestion.proposedFieldChanges, 0);
  assert.equal(cldr.crosswalk.summary.unicodeScriptRowsCompared, 176);
  assert.equal(cldr.crosswalk.summary.cldrMainLocaleFiles, 1122);
  assert.equal(cldr.crosswalk.summary.explicitLocaleScriptLinks, 166);
  assert.equal(cldr.crosswalk.summary.verifiedRows, 20);
  assert.equal(cldr.crosswalk.summary.unknownRows, 156);
  assert.deepEqual(cldr.crosswalk.unmatchedCldrScripts, ["Hans", "Hant"]);
  assert.equal(cldr.diffPreview.summary.proposedFieldChanges, 0);
  assert.equal(cldr.diffPreview.summary.registryMutations, 0);
  assert.equal(cldr.blockers.summary.blockers, 2);
  assert.equal(cldr.blockers.summary.promotionBlocked, true);
  assert.equal(cldr.evidence.checks.officialCldrSourceOnly, true);
  assert.equal(cldr.evidence.checks.noInventedLanguageUsageClaims, true);
  assert.equal(cldr.evidence.checks.noGenealogyClaims, true);
  assert.equal(cldr.evidence.checks.noFontClaims, true);
  assert.equal(cldr.evidence.checks.noRegistryMutation, true);
});

test("Phase 11 ICU API exposes script metadata dry-run without registry mutation", () => {
  const icu = getLipiIcuIngestionView();

  assert.equal(icu.reviewState, "CONTROLLED_NO_GO");
  assert.equal(icu.productionReady, false);
  assert.equal(icu.governedProductionGo, false);
  assert.equal(icu.report.officialSource.id, "icu-official-uscript-source");
  assert.equal(icu.report.ingestion.mode, "ICU_USCRIPT_METADATA_DRY_RUN_ONLY");
  assert.equal(icu.report.ingestion.rowsWritten, 0);
  assert.equal(icu.report.ingestion.enrichedRows, 0);
  assert.equal(icu.report.ingestion.runtimeEnablements, 0);
  assert.equal(icu.report.ingestion.proposedFieldChanges, 0);
  assert.equal(icu.crosswalk.summary.unicodeScriptRowsCompared, 176);
  assert.equal(icu.crosswalk.summary.officialIcuScriptCodes, 213);
  assert.equal(icu.crosswalk.summary.verifiedRows, 168);
  assert.equal(icu.crosswalk.summary.blockedRows, 8);
  assert.equal(icu.crosswalk.summary.extraIcuCodesNotInUcdRegistry, 37);
  assert.equal(icu.diffPreview.summary.proposedFieldChanges, 0);
  assert.equal(icu.diffPreview.summary.registryMutations, 0);
  assert.equal(icu.blockers.summary.blockers, 45);
  assert.equal(icu.blockers.summary.promotionBlocked, true);
  assert.equal(icu.evidence.checks.officialIcuSourceOnly, true);
  assert.equal(icu.evidence.checks.noLocaleInferenceClaims, true);
  assert.equal(icu.evidence.checks.noGenealogyClaims, true);
  assert.equal(icu.evidence.checks.noFontClaims, true);
  assert.equal(icu.evidence.checks.noRenderingClaims, true);
  assert.equal(icu.evidence.checks.noRegistryMutation, true);
});

test("Phases 12-16 governance API exposes dry-run, proposal-only, and gate-blocked state", () => {
  const governance = getLipiPhase12To16GovernanceView();

  assert.equal(governance.reviewState, "CONTROLLED_NO_GO");
  assert.equal(governance.productionReady, false);
  assert.equal(governance.governedProductionGo, false);
  assert.equal(governance.phkdVerdict, "CONTROLLED_NO_GO");
  assert.equal(governance.phase12.report.ingestion.mode, "HARFBUZZ_OPENTYPE_DRY_RUN_ONLY");
  assert.equal(governance.phase12.report.ingestion.rowsWritten, 0);
  assert.equal(governance.phase12.report.ingestion.enrichedRows, 0);
  assert.equal(governance.phase12.report.ingestion.runtimeEnablements, 0);
  assert.equal(governance.phase12.diffPreview.summary.fontSupportClaimsAsserted, 0);
  assert.equal(governance.phase12.diffPreview.summary.shapingClaimsAsserted, 0);
  assert.equal(governance.phase12.blockers.summary.blockers, 10);
  assert.equal(governance.phase13.audit.summary.blockingFindings, 61);
  assert.equal(governance.phase13.audit.summary.autoResolvedConflicts, 0);
  assert.equal(governance.phase14.proposals.summary.proposals, 6);
  assert.equal(governance.phase14.proposals.summary.autoApply, 0);
  assert.equal(governance.phase14.proposals.summary.registryMutations, 0);
  assert.equal(governance.phase15.gateReview.summary.gateStatus, "BLOCKED");
  assert.equal(governance.phase15.gateReview.summary.runtimeEnablementApproved, false);
  assert.equal(governance.phase15.gateReview.summary.runtimeEnabledRows, 0);
  assert.equal(governance.phase16.evidenceBundle.summary.releaseCandidate, false);
  assert.equal(governance.phase16.evidenceBundle.summary.productionReady, false);
  assert.equal(governance.phase16.evidenceBundle.checks.everyIndexedArtifactExists, true);
});

test("Phases 17-19 governance API exposes runbook, review package, and human approval gate", () => {
  const governance = getLipiPhase17To19GovernanceView();

  assert.equal(governance.reviewState, "CONTROLLED_NO_GO");
  assert.equal(governance.productionReady, false);
  assert.equal(governance.governedProductionGo, false);
  assert.equal(governance.phkdVerdict, "CONTROLLED_NO_GO");
  assert.equal(governance.phase17.operatorRunbook.summary.seedRows, 426);
  assert.equal(governance.phase17.operatorRunbook.summary.runSequenceSteps, 5);
  assert.equal(governance.phase17.operatorRunbook.summary.productionGoAllowed, false);
  assert.equal(governance.phase17.operatorRunbook.summary.runtimeEnablements, 0);
  assert.equal(governance.phase17.evidence.checks.noRegistryMutation, true);
  assert.equal(governance.phase18.externalReviewPackage.reviewPackage.status, "PENDING_EXTERNAL_REVIEW");
  assert.equal(governance.phase18.externalReviewPackage.reviewPackage.reviewersAssigned, 0);
  assert.equal(governance.phase18.externalReviewPackage.reviewPackage.reviewerSignoffs, 0);
  assert.equal(governance.phase18.externalReviewPackage.reviewPackage.reviewComplete, false);
  assert.equal(governance.phase18.externalReviewPackage.reviewPackage.createsNewClaims, false);
  assert.equal(governance.phase18.externalReviewPackage.reviewPackage.mutatesRegistry, false);
  assert.equal(governance.phase18.evidence.checks.noNewClaims, true);
  assert.equal(governance.phase19.productionGoGate.summary.productionGoApproved, false);
  assert.equal(governance.phase19.productionGoGate.summary.humanApprovalPresent, false);
  assert.equal(governance.phase19.productionGoGate.summary.activeProductionGoBlockers, 4);
  assert.equal(governance.phase19.productionGoGate.summary.runtimeEnablements, 0);
  assert.equal(governance.phase19.productionGoGate.gatePolicy.rule, "PRODUCTION_GO_ONLY_AFTER_HUMAN_APPROVAL_AND_ZERO_BLOCKERS");
  assert.equal(governance.phase19.evidence.checks.humanApprovalMissingBlocksGo, true);
});

test("auditability API exposes reproducible exports and provenance checks without new claims", () => {
  const auditability = getLipiRegistryAuditabilityView();

  assert.equal(auditability.reviewState, "CONTROLLED_NO_GO");
  assert.equal(auditability.productionReady, false);
  assert.equal(auditability.governedProductionGo, false);
  assert.equal(auditability.phkdVerdict, "CONTROLLED_NO_GO");
  assert.ok(auditability.exportCenter.outputHashes.some((artifact) => artifact.path === "release/exports/hkd-lipi-registry-export.json"));
  assert.ok(auditability.exportCenter.outputHashes.some((artifact) => artifact.path === "release/exports/hkd-lipi-registry-export.csv"));
  assert.ok(auditability.exportCenter.outputHashes.some((artifact) => artifact.path === "release/exports/hkd-lipi-registry-export.sql"));
  assert.equal(auditability.evidenceAudit.checks.everyNodeReachableFromProvenance, true);
  assert.equal(auditability.evidenceAudit.checks.noOrphanEvidenceReferences, true);
  assert.equal(auditability.evidenceAudit.checks.noRuntimeEnabledTrue, true);
  assert.equal(auditability.evidenceAudit.checks.noProductionReadyTrue, true);
  assert.equal(auditability.provenance.counts.nodesUnreachableFromProvenance, 0);
  assert.equal(auditability.registryDiff.changedCriticalFields.length, 0);
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
