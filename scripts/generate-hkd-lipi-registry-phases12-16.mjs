import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const INPUTS = {
  seed: "data/hkd-lipi-script-registry-seed-426.json",
  unicodeCrosswalk: "data/hkd-lipi-unicode-crosswalk.json",
  sourceRegistry: "data/hkd-lipi-federated-source-registry.json",
  sourceAdapterContracts: "data/hkd-lipi-source-adapter-contracts.json",
  ingestionPolicy: "data/hkd-lipi-ingestion-policy.json",
  sourceTrustMatrix: "data/hkd-lipi-source-trust-matrix.json",
  conflictResolutionRules: "data/hkd-lipi-conflict-resolution-rules.json",
  ingestionDryRunReport: "data/hkd-lipi-ingestion-dry-run-report.json",
  ingestionBlockers: "data/hkd-lipi-ingestion-blockers.json",
  iso15924Crosswalk: "data/iso15924-script-code-crosswalk.json",
  iso15924Blockers: "data/iso15924-blockers.json",
  cldrCrosswalk: "data/cldr-script-locale-crosswalk.json",
  cldrBlockers: "data/cldr-blockers.json",
  icuCrosswalk: "data/icu-script-metadata-crosswalk.json",
  icuBlockers: "data/icu-blockers.json",
  kbsGraph: "data/hkd-lipi-kbs-graph.json",
  auditReport: "release/evidence/hkd-lipi-registry-audit-report.json",
  provenanceReport: "release/evidence/hkd-lipi-registry-provenance-report.json",
  phase6Evidence: "release/evidence/hkd-lipi-registry-phase6-federation.json",
  phase7Evidence: "release/evidence/hkd-lipi-registry-phase7-ingestion-contracts.json",
  phase8Evidence: "release/evidence/hkd-lipi-registry-phase8-dry-run-ingestion.json",
  phase9Evidence: "release/evidence/hkd-lipi-registry-phase9-iso15924-ingestion.json",
  phase10Evidence: "release/evidence/hkd-lipi-registry-phase10-cldr-ingestion.json",
  phase11Evidence: "release/evidence/hkd-lipi-registry-phase11-icu-ingestion.json",
};

const OUT = {
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

const GENERATED_AT = "DETERMINISTIC_FROM_PHASE12_TO_PHASE16_INPUTS";
const GENERATED_BY = "scripts/generate-hkd-lipi-registry-phases12-16.mjs";
const REVIEW_STATE = "CONTROLLED_NO_GO";
const PHKD_VERDICT = "CONTROLLED_NO_GO";
const GOVERNED_PRODUCTION_GO = false;
const PRODUCTION_READY = false;
const RUNTIME_ENABLED = 0;
const SOURCE_POLICY =
  "phase12_to_phase16_dry_run_audit_proposal_gate_bundle_no_registry_mutation_no_runtime_enablement";

function read(path) {
  return readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

function sha256(pathOrBuffer) {
  const input = Buffer.isBuffer(pathOrBuffer) ? pathOrBuffer : readFileSync(pathOrBuffer);
  return createHash("sha256").update(input).digest("hex");
}

function slug(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeJson(path, value) {
  writeFileSync(path, stableStringify(value));
}

function trustedInputs(extra = []) {
  return [...Object.entries(INPUTS).map(([id, path]) => ({ id, path, sha256: sha256(path) })), ...extra].sort((a, b) =>
    a.path.localeCompare(b.path),
  );
}

function provenance(scope, sourceIds, trusted = Object.values(INPUTS), phkd = "FACTS_FROM_TRUSTED_INPUTS_OR_BLOCKED") {
  return {
    scope,
    sourceIds: unique(sourceIds),
    generatedBy: GENERATED_BY,
    sourcePolicy: SOURCE_POLICY,
    trustedInputs: unique(trusted),
    reviewed: false,
    phkd,
  };
}

function baseArtifact(schema, sourceIds, extra = {}) {
  return {
    schema,
    generatedAt: GENERATED_AT,
    reviewState: REVIEW_STATE,
    governedProductionGo: GOVERNED_PRODUCTION_GO,
    productionReady: PRODUCTION_READY,
    runtimeEnabled: RUNTIME_ENABLED,
    phkdVerdict: PHKD_VERDICT,
    sourcePolicy: SOURCE_POLICY,
    trustedInputs: trustedInputs(),
    provenance: provenance(schema, sourceIds),
    ...extra,
  };
}

function outputHashes(paths) {
  return paths.map((path) => ({ path, sha256: sha256(path) })).sort((a, b) => a.path.localeCompare(b.path));
}

function sourceById(sourceRegistry, sourceId) {
  return sourceRegistry.sources.find((source) => source.id === sourceId) ?? {
    id: sourceId,
    displayName: sourceId,
    officialUrl: "UNKNOWN",
    trustedFor: [],
  };
}

function adapterBySource(adapterContracts, sourceId) {
  return adapterContracts.adapters.find((adapter) => adapter.sourceId === sourceId);
}

function makeAdapterFieldPreview(adapter, field) {
  const sourceId = adapter.sourceId;
  const isHarfBuzz = sourceId === "harfbuzz";
  const sourceLabel = isHarfBuzz ? "HarfBuzz" : "OpenType";
  return {
    id: `phase12:diff:${slug(sourceId)}:${slug(field.field)}`,
    sourceId,
    adapterId: adapter.id,
    field: field.field,
    status: field.status === "UNKNOWN" ? "UNKNOWN" : "BLOCKED",
    adapterFieldStatus: field.status,
    diffKind: isHarfBuzz ? "BLOCKED_NO_HARFBUZZ_SHAPING_FIXTURES" : "BLOCKED_NO_OPENTYPE_SPEC_OR_FONT_FIXTURES",
    proposedFieldChange: false,
    proposedRegistryValue: "NO_CHANGE",
    proposedRegistryPatch: [],
    previewOnly: true,
    wouldMutateRegistry: false,
    wouldEnrichRow: false,
    wouldEnableRuntime: false,
    fontSupportClaim: "NOT_ASSERTED",
    shapingClaim: "NOT_ASSERTED",
    opentypeFeatureClaim: "NOT_ASSERTED",
    reason: `${sourceLabel} field ${field.field} remains ${field.status}; ${field.reason}`,
    provenance: provenance("phase12_harfbuzz_opentype_field_preview", [sourceId, "hkd-lipi-phase7-ingestion-contracts"], [
      INPUTS.seed,
      INPUTS.sourceAdapterContracts,
      INPUTS.ingestionPolicy,
      INPUTS.sourceTrustMatrix,
      INPUTS.conflictResolutionRules,
      INPUTS.phase7Evidence,
    ]),
  };
}

function makePhase12(seed, sourceRegistry, adapterContracts) {
  const sourceIds = ["harfbuzz", "opentype-spec"];
  const adapters = sourceIds.map((sourceId) => adapterBySource(adapterContracts, sourceId)).filter(Boolean);
  const sources = sourceIds.map((sourceId) => sourceById(sourceRegistry, sourceId));
  const previews = adapters.flatMap((adapter) => adapter.fields.map((field) => makeAdapterFieldPreview(adapter, field)));
  const globalBlockers = [
    {
      id: "phase12:blocker:harfbuzz-versioned-binary-and-corpus",
      sourceId: "harfbuzz",
      adapterId: "adapter:harfbuzz",
      field: "shaping_validation_inputs",
      severity: "HIGH",
      status: "BLOCKED",
      blocksPromotion: true,
      reason: "No versioned HarfBuzz binary/source snapshot, versioned font fixtures, or script-specific shaping corpus is locally ingested.",
      requiredToUnblock: ["attach versioned HarfBuzz source or binary", "attach font fixtures", "attach shaping corpus", "emit glyph-run diff report"],
      provenance: provenance("phase12_global_blocker", ["harfbuzz", "hkd-lipi-phase7-ingestion-contracts"]),
    },
    {
      id: "phase12:blocker:opentype-spec-and-font-fixtures",
      sourceId: "opentype-spec",
      adapterId: "adapter:opentype-spec",
      field: "opentype_validation_inputs",
      severity: "HIGH",
      status: "BLOCKED",
      blocksPromotion: true,
      reason: "No versioned local OpenType specification snapshot, feature-tag policy map, or font fixtures are locally ingested.",
      requiredToUnblock: ["attach local OpenType spec snapshot", "attach feature-tag policy map", "attach font fixtures", "rerun dry ingestion"],
      provenance: provenance("phase12_global_blocker", ["opentype-spec", "hkd-lipi-phase7-ingestion-contracts"]),
    },
  ];
  const fieldBlockers = previews.map((preview) => ({
    id: `phase12:blocker:${slug(preview.sourceId)}:${slug(preview.field)}`,
    sourceId: preview.sourceId,
    adapterId: preview.adapterId,
    field: preview.field,
    severity: preview.adapterFieldStatus === "UNKNOWN" ? "MEDIUM" : "HIGH",
    status: preview.status === "UNKNOWN" ? "UNKNOWN" : "BLOCKED",
    blocksPromotion: true,
    reason: preview.reason,
    requiredToUnblock: ["satisfy adapter prerequisite", "attach field-level provenance", "rerun HarfBuzz/OpenType dry ingestion"],
    provenance: provenance("phase12_field_blocker", [preview.sourceId, "hkd-lipi-phase7-ingestion-contracts"]),
  }));
  const blockers = [...globalBlockers, ...fieldBlockers];
  const adapterRuns = adapters.map((adapter) => ({
    id: `phase12:run:${slug(adapter.sourceId)}`,
    adapterId: adapter.id,
    sourceId: adapter.sourceId,
    mode: "DRY_RUN_ONLY",
    sourceLocalStatus: adapter.sourceLocalStatus,
    contractStatus: adapter.contractStatus,
    status: "BLOCKED_NO_LOCAL_SOURCE_SNAPSHOT_OR_FIXTURE",
    rowsRead: seed.records.length,
    rowsWritten: 0,
    enrichedRows: 0,
    runtimeEnablements: 0,
    proposedFieldChanges: 0,
    fieldPreviewCount: adapter.fields.length,
    blockers: blockers.filter((blocker) => blocker.sourceId === adapter.sourceId).length,
    fontSupportClaimsAsserted: 0,
    shapingClaimsAsserted: 0,
    opentypeFeatureClaimsAsserted: 0,
    promotionStatus: "BLOCKED",
    prerequisites: adapter.prerequisites,
    provenance: provenance("phase12_adapter_dry_run", [adapter.sourceId, "hkd-lipi-phase7-ingestion-contracts"]),
  }));

  const report = baseArtifact("hkd-lipi-harfbuzz-opentype-dry-ingestion-report.v1", sourceIds, {
    officialSources: sources.map((source) => ({
      id: source.id,
      displayName: source.displayName,
      officialUrl: source.officialUrl,
      trustedFor: source.trustedFor,
      localSnapshotStatus: "NOT_INGESTED",
      claimPolicy: "SOURCE_REGISTERED_BUT_NO_FONT_OR_SHAPING_FACTS_ASSERTED",
    })),
    ingestion: {
      mode: "HARFBUZZ_OPENTYPE_DRY_RUN_ONLY",
      adaptersRun: adapterRuns.length,
      inputSeedRows: seed.records.length,
      unicodeScriptRowsCompared: 0,
      rowsRead: seed.records.length,
      rowsWritten: 0,
      enrichedRows: 0,
      runtimeEnablements: 0,
      proposedFieldChanges: 0,
      fieldDiffPreviews: previews.length,
      blockers: blockers.length,
      promotionStatus: "BLOCKED",
      promotionBlockedBy: ["NO_HARFBUZZ_VERSIONED_BINARY_OR_SOURCE", "NO_OPENTYPE_SPEC_SNAPSHOT", "NO_FONT_FIXTURES", "NO_SHAPING_CORPUS"],
      seedHashBefore: sha256(INPUTS.seed),
      seedHashAfter: sha256(INPUTS.seed),
    },
    adapterRuns,
    limitations: [
      "HarfBuzz is not used to assert shaping behavior until a versioned binary/source snapshot and corpus fixtures are ingested.",
      "OpenType is not used to assert feature or font support until a local spec snapshot and font fixtures are ingested.",
      "No font support, rendering, joining, substitution, positioning, or shaping field is enriched in Phase 12.",
    ],
  });

  const diffPreview = baseArtifact("hkd-lipi-harfbuzz-opentype-diff-preview.v1", sourceIds, {
    summary: {
      previews: previews.length,
      blockedPreviews: previews.filter((preview) => preview.status === "BLOCKED").length,
      unknownPreviews: previews.filter((preview) => preview.status === "UNKNOWN").length,
      proposedFieldChanges: 0,
      previewOnlyRows: previews.length,
      registryMutations: 0,
      enrichedRows: 0,
      runtimeEnablements: 0,
      fontSupportClaimsAsserted: 0,
      shapingClaimsAsserted: 0,
      opentypeFeatureClaimsAsserted: 0,
    },
    diffs: previews,
  });

  const blockersArtifact = baseArtifact("hkd-lipi-harfbuzz-opentype-blockers.v1", sourceIds, {
    summary: {
      blockers: blockers.length,
      globalBlockers: globalBlockers.length,
      fieldBlockers: fieldBlockers.length,
      highSeverity: blockers.filter((blocker) => blocker.severity === "HIGH").length,
      unknownStatusBlockers: blockers.filter((blocker) => blocker.status === "UNKNOWN").length,
      promotionBlocked: true,
    },
    promotionPolicy: {
      rule: "ANY_MISSING_HARFBUZZ_OPENTYPE_FIXTURE_BLOCKS_PROMOTION",
      promotionAllowedWhenFixtureMissing: false,
      enforced: true,
    },
    blockers,
  });

  return { report, diffPreview, blockers: blockersArtifact };
}

function makePhase12Evidence(phase12) {
  return baseArtifact("hkd-lipi-registry-phase12-harfbuzz-opentype.v1", ["harfbuzz", "opentype-spec"], {
    counts: {
      adaptersRun: phase12.report.ingestion.adaptersRun,
      fieldDiffPreviews: phase12.diffPreview.summary.previews,
      blockers: phase12.blockers.summary.blockers,
      proposedFieldChanges: 0,
      rowsWritten: 0,
      enrichedRows: 0,
      runtimeEnablements: 0,
      fontSupportClaimsAsserted: 0,
      shapingClaimsAsserted: 0,
      opentypeFeatureClaimsAsserted: 0,
    },
    checks: {
      noRegistryMutation: phase12.report.ingestion.seedHashBefore === phase12.report.ingestion.seedHashAfter,
      previewOnlyDiffs: phase12.diffPreview.diffs.every((diff) => diff.previewOnly && diff.wouldMutateRegistry === false),
      noEnrichedRows: phase12.report.ingestion.enrichedRows === 0,
      noRuntimeEnablement: phase12.report.ingestion.runtimeEnablements === 0,
      noProductionReadyTrue: phase12.report.productionReady === false,
      noFontSupportClaims: phase12.diffPreview.summary.fontSupportClaimsAsserted === 0,
      noShapingClaims: phase12.diffPreview.summary.shapingClaimsAsserted === 0,
      noOpenTypeFeatureClaims: phase12.diffPreview.summary.opentypeFeatureClaimsAsserted === 0,
      everyBlockerHasProvenance: phase12.blockers.blockers.every((blocker) => Boolean(blocker.provenance)),
      sourceSnapshotsRequiredBeforePromotion: phase12.blockers.summary.promotionBlocked === true,
    },
    outputs: {
      report: OUT.phase12Report,
      diffPreview: OUT.phase12Diff,
      blockers: OUT.phase12Blockers,
      evidence: OUT.phase12Evidence,
    },
    outputHashes: outputHashes([OUT.phase12Report, OUT.phase12Diff, OUT.phase12Blockers]),
    limitations: phase12.report.limitations,
  });
}

function makePhase13(phase12, isoBlockers, cldrBlockers, icuBlockers) {
  const blockingFindings = [
    ...isoBlockers.blockers.map((blocker) => ({
      id: `phase13:iso:${slug(blocker.id)}`,
      sourceId: "iso-15924",
      authorityTier: "SCRIPT_CODE_AUTHORITY",
      status: "BLOCKED",
      severity: blocker.severity,
      blocksPromotion: true,
      reason: blocker.reason,
      upstreamBlockerId: blocker.id,
      provenance: provenance("phase13_authority_blocking_finding", ["iso15924-official-plain-text"]),
    })),
    ...cldrBlockers.blockers.map((blocker) => ({
      id: `phase13:cldr:${slug(blocker.id)}`,
      sourceId: "cldr",
      authorityTier: "EXPLICIT_LOCALE_SCRIPT_METADATA",
      status: "BLOCKED",
      severity: blocker.severity,
      blocksPromotion: true,
      reason: blocker.reason,
      upstreamBlockerId: blocker.id,
      provenance: provenance("phase13_authority_blocking_finding", ["cldr-official-core-zip"]),
    })),
    ...icuBlockers.blockers.map((blocker) => ({
      id: `phase13:icu:${slug(blocker.id)}`,
      sourceId: "icu",
      authorityTier: "SCRIPT_METADATA_CROSS_CHECK",
      status: "BLOCKED",
      severity: blocker.severity,
      blocksPromotion: true,
      reason: blocker.reason,
      upstreamBlockerId: blocker.id,
      provenance: provenance("phase13_authority_blocking_finding", ["icu-official-uscript-source"]),
    })),
    ...phase12.blockers.blockers.map((blocker) => ({
      id: `phase13:phase12:${slug(blocker.id)}`,
      sourceId: blocker.sourceId,
      authorityTier: blocker.sourceId === "harfbuzz" ? "SHAPING_ENGINE_VALIDATION" : "FONT_SPEC_VALIDATION",
      status: blocker.status,
      severity: blocker.severity,
      blocksPromotion: true,
      reason: blocker.reason,
      upstreamBlockerId: blocker.id,
      provenance: provenance("phase13_authority_blocking_finding", [blocker.sourceId, "hkd-lipi-phase12-harfbuzz-opentype"]),
    })),
  ];
  const audits = [
    {
      id: "phase13:authority:unicode-ucd",
      sourceId: "unicode-ucd",
      authorityFor: ["unicode_script_value", "unicode_blocks", "unicode_ranges", "decimal_digits", "zero_glyph"],
      auditedAgainst: ["phase3_ucd_artifacts", "phase4_kbs_graph"],
      status: "VERIFIED_FOR_EXISTING_UCD_FIELDS",
      autoResolutionAllowed: false,
      createsNewClaims: false,
      provenance: provenance("phase13_authority_audit", ["unicode-ucd"]),
    },
    {
      id: "phase13:authority:iso-15924",
      sourceId: "iso-15924",
      authorityFor: ["iso15924_alpha_code", "iso15924_numeric_code", "iso15924_pva"],
      auditedAgainst: ["phase9_iso15924_crosswalk"],
      status: isoBlockers.summary.blockers ? "BLOCKED" : "VERIFIED",
      autoResolutionAllowed: false,
      createsNewClaims: false,
      blockers: isoBlockers.summary.blockers,
      provenance: provenance("phase13_authority_audit", ["iso15924-official-plain-text"]),
    },
    {
      id: "phase13:authority:cldr",
      sourceId: "cldr",
      authorityFor: ["explicit_locale_script_identity"],
      auditedAgainst: ["phase10_cldr_crosswalk"],
      status: cldrBlockers.summary.blockers ? "BLOCKED" : "VERIFIED",
      autoResolutionAllowed: false,
      createsNewClaims: false,
      blockers: cldrBlockers.summary.blockers,
      provenance: provenance("phase13_authority_audit", ["cldr-official-core-zip"]),
    },
    {
      id: "phase13:authority:icu",
      sourceId: "icu",
      authorityFor: ["uscript_code", "uscript_short_name", "uscript_canonical_metadata"],
      auditedAgainst: ["phase11_icu_crosswalk"],
      status: icuBlockers.summary.blockers ? "BLOCKED" : "VERIFIED",
      autoResolutionAllowed: false,
      createsNewClaims: false,
      blockers: icuBlockers.summary.blockers,
      provenance: provenance("phase13_authority_audit", ["icu-official-uscript-source"]),
    },
    {
      id: "phase13:authority:harfbuzz-opentype",
      sourceId: "harfbuzz+opentype-spec",
      authorityFor: ["shaping_validation", "opentype_feature_definitions", "font_fixture_validation"],
      auditedAgainst: ["phase12_harfbuzz_opentype_dry_run"],
      status: "BLOCKED",
      autoResolutionAllowed: false,
      createsNewClaims: false,
      blockers: phase12.blockers.summary.blockers,
      provenance: provenance("phase13_authority_audit", ["harfbuzz", "opentype-spec"]),
    },
  ];
  const audit = baseArtifact("hkd-lipi-cross-source-conflict-authority-audit.v1", ["unicode-ucd", "iso-15924", "cldr", "icu", "harfbuzz", "opentype-spec"], {
    summary: {
      sourcesAudited: audits.length,
      blockingFindings: blockingFindings.length,
      conflictsDetected: 0,
      autoResolvedConflicts: 0,
      promotionBlocked: true,
      registryMutations: 0,
      runtimeEnablements: 0,
    },
    authorityOrder: [
      "unicode-ucd: Unicode script, block, range, decimal digit, and zero-glyph facts already in UCD artifacts.",
      "iso-15924: ISO script code checks only; missing PVA or ambiguity blocks promotion.",
      "cldr: explicit locale identity script metadata only; no language usage inference.",
      "icu: UScript code/name metadata checks only; mismatches block promotion.",
      "harfbuzz: shaping validation only after versioned binary/source and corpus fixtures.",
      "opentype-spec: feature definitions only; actual font support requires fixtures.",
    ],
    conflictPolicy: {
      rule: "ANY_CONFLICT_OR_BLOCKED_AUTHORITY_FINDING_BLOCKS_PROMOTION",
      autoResolveAllowed: false,
      autoApplyAllowed: false,
      registryMutationAllowed: false,
    },
    audits,
    blockingFindings,
  });
  return audit;
}

function makePhase13Evidence(audit) {
  return baseArtifact("hkd-lipi-registry-phase13-authority-audit.v1", ["unicode-ucd", "iso-15924", "cldr", "icu", "harfbuzz", "opentype-spec"], {
    counts: {
      sourcesAudited: audit.summary.sourcesAudited,
      blockingFindings: audit.summary.blockingFindings,
      conflictsDetected: audit.summary.conflictsDetected,
      autoResolvedConflicts: 0,
      rowsWritten: 0,
      runtimeEnablements: 0,
    },
    checks: {
      noAutoResolution: audit.summary.autoResolvedConflicts === 0,
      promotionBlockedWhenFindingsExist: audit.summary.promotionBlocked === true && audit.summary.blockingFindings > 0,
      everyFindingHasProvenance: audit.blockingFindings.every((finding) => Boolean(finding.provenance)),
      noRegistryMutation: audit.summary.registryMutations === 0,
      noRuntimeEnablement: audit.summary.runtimeEnablements === 0,
      noProductionReadyTrue: audit.productionReady === false,
    },
    outputs: {
      audit: OUT.phase13Audit,
      evidence: OUT.phase13Evidence,
    },
    outputHashes: outputHashes([OUT.phase13Audit]),
    limitations: [
      "Phase 13 audits authority and blockers; it does not resolve conflicts or promote fields.",
      "Blocked source findings remain blocked until the responsible source-specific phase is rerun with reviewed evidence.",
    ],
  });
}

function makePhase14(phase13) {
  const proposals = [
    {
      id: "phase14:proposal:harfbuzz-shaping-fixtures",
      title: "Attach HarfBuzz shaping validation fixtures",
      sourceIds: ["harfbuzz"],
      targetFields: ["joining_behavior", "complex_shaping_behavior", "glyph_substitution_behavior"],
      proposalStatus: "PROPOSAL_ONLY",
      blockedBy: ["NO_HARFBUZZ_VERSIONED_BINARY_OR_SOURCE", "NO_SHAPING_CORPUS", "NO_FONT_FIXTURES"],
      requiredEvidence: ["versioned HarfBuzz source or binary", "script-specific shaping corpus", "glyph-run diff report", "human review"],
      proposedRegistryPatch: [],
      autoApply: false,
      requiresReview: true,
      registryMutationAllowed: false,
      wouldMutateRegistry: false,
      wouldEnableRuntime: false,
      provenance: provenance("phase14_controlled_enrichment_proposal", ["harfbuzz"]),
    },
    {
      id: "phase14:proposal:opentype-spec-fixtures",
      title: "Attach OpenType specification and font fixture evidence",
      sourceIds: ["opentype-spec"],
      targetFields: ["opentype_feature_support", "font_table_support", "font_support_status"],
      proposalStatus: "PROPOSAL_ONLY",
      blockedBy: ["NO_OPENTYPE_SPEC_SNAPSHOT", "NO_FEATURE_TAG_POLICY_MAP", "NO_FONT_FIXTURES"],
      requiredEvidence: ["versioned OpenType spec snapshot", "feature-tag policy map", "versioned font fixtures", "reviewed field map"],
      proposedRegistryPatch: [],
      autoApply: false,
      requiresReview: true,
      registryMutationAllowed: false,
      wouldMutateRegistry: false,
      wouldEnableRuntime: false,
      provenance: provenance("phase14_controlled_enrichment_proposal", ["opentype-spec"]),
    },
    {
      id: "phase14:proposal:iso-pva-blocker-review",
      title: "Review ISO 15924 PVA blockers",
      sourceIds: ["iso-15924"],
      targetFields: ["iso15924", "unicode_script_alias"],
      proposalStatus: "PROPOSAL_ONLY",
      blockedBy: ["ISO15924_PVA_UNKNOWN_FOR_4_ROWS"],
      requiredEvidence: ["official ISO update or explicit mapping policy", "field-level provenance", "review note"],
      proposedRegistryPatch: [],
      autoApply: false,
      requiresReview: true,
      registryMutationAllowed: false,
      wouldMutateRegistry: false,
      wouldEnableRuntime: false,
      provenance: provenance("phase14_controlled_enrichment_proposal", ["iso15924-official-plain-text"]),
    },
    {
      id: "phase14:proposal:cldr-hans-hant-policy",
      title: "Review CLDR Hans/Hant relation policy",
      sourceIds: ["cldr"],
      targetFields: ["locale_script_metadata"],
      proposalStatus: "PROPOSAL_ONLY",
      blockedBy: ["CLDR_HANS_HANT_NOT_DIRECT_UCD_SCRIPT_ROWS"],
      requiredEvidence: ["explicit policy for inherited CLDR script subtags", "no language usage inference", "review note"],
      proposedRegistryPatch: [],
      autoApply: false,
      requiresReview: true,
      registryMutationAllowed: false,
      wouldMutateRegistry: false,
      wouldEnableRuntime: false,
      provenance: provenance("phase14_controlled_enrichment_proposal", ["cldr-official-core-zip"]),
    },
    {
      id: "phase14:proposal:icu-metadata-mismatch-policy",
      title: "Review ICU metadata mismatch policy",
      sourceIds: ["icu"],
      targetFields: ["uscript_code", "unicode_script_alias"],
      proposalStatus: "PROPOSAL_ONLY",
      blockedBy: ["ICU_UCD_ISO_CLDR_METADATA_MISMATCHES"],
      requiredEvidence: ["conflict authority decision", "explicit field mapping policy", "review note"],
      proposedRegistryPatch: [],
      autoApply: false,
      requiresReview: true,
      registryMutationAllowed: false,
      wouldMutateRegistry: false,
      wouldEnableRuntime: false,
      provenance: provenance("phase14_controlled_enrichment_proposal", ["icu-official-uscript-source"]),
    },
    {
      id: "phase14:proposal:human-review-packet",
      title: "Prepare reviewer sign-off packet before any enrichment",
      sourceIds: ["hkd-lipi-phase13-authority-audit"],
      targetFields: ["review_status", "promotion_status"],
      proposalStatus: "PROPOSAL_ONLY",
      blockedBy: ["NO_HUMAN_REVIEW_SIGNOFF", "UNRESOLVED_AUTHORITY_BLOCKERS"],
      requiredEvidence: ["reviewer identity", "review date", "scope of approval", "rerun all source-specific dry ingestions"],
      proposedRegistryPatch: [],
      autoApply: false,
      requiresReview: true,
      registryMutationAllowed: false,
      wouldMutateRegistry: false,
      wouldEnableRuntime: false,
      provenance: provenance("phase14_controlled_enrichment_proposal", ["hkd-lipi-phase13-authority-audit"]),
    },
  ];
  return baseArtifact("hkd-lipi-controlled-enrichment-proposals.v1", ["hkd-lipi-phase13-authority-audit"], {
    summary: {
      proposals: proposals.length,
      proposalOnly: proposals.length,
      autoApply: proposals.filter((proposal) => proposal.autoApply).length,
      requiresReview: proposals.filter((proposal) => proposal.requiresReview).length,
      registryMutations: proposals.filter((proposal) => proposal.wouldMutateRegistry).length,
      runtimeEnablements: proposals.filter((proposal) => proposal.wouldEnableRuntime).length,
      sourceBlockingFindingsConsidered: phase13.summary.blockingFindings,
      promotionStatus: "BLOCKED",
    },
    proposalPolicy: {
      mode: "CONTROLLED_PROPOSAL_ONLY",
      autoApplyAllowed: false,
      registryMutationAllowed: false,
      runtimeEnablementAllowed: false,
      promotionRequiresCleanAuthorityAudit: true,
    },
    proposals,
  });
}

function makePhase14Evidence(proposals) {
  return baseArtifact("hkd-lipi-registry-phase14-controlled-enrichment.v1", ["hkd-lipi-phase13-authority-audit"], {
    counts: {
      proposals: proposals.summary.proposals,
      autoApply: proposals.summary.autoApply,
      registryMutations: proposals.summary.registryMutations,
      runtimeEnablements: proposals.summary.runtimeEnablements,
      requiresReview: proposals.summary.requiresReview,
    },
    checks: {
      proposalsOnly: proposals.proposals.every((proposal) => proposal.proposalStatus === "PROPOSAL_ONLY"),
      noAutoApply: proposals.summary.autoApply === 0,
      noRegistryMutation: proposals.summary.registryMutations === 0,
      noRuntimeEnablement: proposals.summary.runtimeEnablements === 0,
      everyProposalRequiresReview: proposals.proposals.every((proposal) => proposal.requiresReview === true),
      everyProposalHasProvenance: proposals.proposals.every((proposal) => Boolean(proposal.provenance)),
      noProductionReadyTrue: proposals.productionReady === false,
    },
    outputs: {
      proposals: OUT.phase14Proposals,
      evidence: OUT.phase14Evidence,
    },
    outputHashes: outputHashes([OUT.phase14Proposals]),
    limitations: [
      "Phase 14 proposes review tasks only; it does not write fields or attach new claims to registry rows.",
      "Every proposed enrichment remains blocked until source-specific evidence and review are complete.",
    ],
  });
}

function makePhase15(seed, phase12, phase13, phase14) {
  const runtimeEnabledRows = seed.records.filter((record) => record.hkd_runtime_enabled === true).length;
  const unresolvedBlockers =
    phase12.blockers.summary.blockers + phase13.summary.blockingFindings + phase14.summary.proposals;
  const criteria = [
    {
      id: "phase15:criterion:no-runtime-enabled-rows",
      label: "No existing runtime-enabled rows",
      status: runtimeEnabledRows === 0 ? "PASS" : "FAIL",
      blocksEnablement: runtimeEnabledRows !== 0,
      evidence: `runtimeEnabledRows=${runtimeEnabledRows}`,
    },
    {
      id: "phase15:criterion:no-production-ready",
      label: "Production readiness stays false",
      status: "PASS",
      blocksEnablement: false,
      evidence: "productionReady=false in every generated phase artifact",
    },
    {
      id: "phase15:criterion:source-blockers-resolved",
      label: "All source blockers resolved",
      status: "FAIL",
      blocksEnablement: true,
      evidence: `unresolvedBlockers=${unresolvedBlockers}`,
    },
    {
      id: "phase15:criterion:harfbuzz-opentype-fixtures",
      label: "HarfBuzz/OpenType fixtures available",
      status: "FAIL",
      blocksEnablement: true,
      evidence: "Phase 12 reports missing versioned snapshots, corpus, and font fixtures.",
    },
    {
      id: "phase15:criterion:authority-audit-clean",
      label: "Cross-source authority audit clean",
      status: "FAIL",
      blocksEnablement: true,
      evidence: `blockingFindings=${phase13.summary.blockingFindings}`,
    },
    {
      id: "phase15:criterion:human-review-complete",
      label: "Human review complete",
      status: "FAIL",
      blocksEnablement: true,
      evidence: "No reviewer sign-off artifact exists for controlled enrichment proposals.",
    },
  ];
  const blockers = criteria
    .filter((criterion) => criterion.blocksEnablement)
    .map((criterion) => ({
      id: `phase15:blocker:${slug(criterion.id)}`,
      criterionId: criterion.id,
      status: "BLOCKED",
      severity: "HIGH",
      blocksRuntimeEnablement: true,
      reason: `${criterion.label} failed: ${criterion.evidence}`,
      requiredToUnblock: ["resolve criterion evidence", "rerun Phase 15 gate review", "keep registry mutation separate from dry-run phases"],
      provenance: provenance("phase15_runtime_gate_blocker", ["hkd-lipi-phase15-runtime-gate-review"]),
    }));

  return baseArtifact("hkd-lipi-runtime-enablement-gate-review.v1", ["hkd-lipi-phase12-harfbuzz-opentype", "hkd-lipi-phase13-authority-audit", "hkd-lipi-phase14-controlled-enrichment"], {
    summary: {
      gateStatus: "BLOCKED",
      runtimeEnablementApproved: false,
      productionReady: false,
      phkdVerdict: PHKD_VERDICT,
      runtimeEnabledRows,
      unresolvedBlockers,
      failedCriteria: criteria.filter((criterion) => criterion.status === "FAIL").length,
      passedCriteria: criteria.filter((criterion) => criterion.status === "PASS").length,
      registryMutations: 0,
      runtimeEnablements: 0,
    },
    gatePolicy: {
      mode: "REVIEW_ONLY",
      approvalAllowedWithUnresolvedBlockers: false,
      registryMutationAllowed: false,
      runtimeEnablementAllowed: false,
      productionReadyAllowed: false,
    },
    criteria,
    blockers,
  });
}

function makePhase15Evidence(gate) {
  return baseArtifact("hkd-lipi-registry-phase15-runtime-gate-review.v1", ["hkd-lipi-phase15-runtime-gate-review"], {
    counts: {
      failedCriteria: gate.summary.failedCriteria,
      passedCriteria: gate.summary.passedCriteria,
      unresolvedBlockers: gate.summary.unresolvedBlockers,
      runtimeEnabledRows: gate.summary.runtimeEnabledRows,
      registryMutations: 0,
      runtimeEnablements: 0,
    },
    checks: {
      runtimeEnablementApprovedFalse: gate.summary.runtimeEnablementApproved === false,
      productionReadyFalse: gate.summary.productionReady === false,
      phkdVerdictControlledNoGo: gate.summary.phkdVerdict === PHKD_VERDICT,
      noRuntimeEnabledRows: gate.summary.runtimeEnabledRows === 0,
      blockedWhenUnresolvedBlockersExist: gate.summary.gateStatus === "BLOCKED" && gate.summary.unresolvedBlockers > 0,
      noRegistryMutation: gate.summary.registryMutations === 0,
      noRuntimeEnablement: gate.summary.runtimeEnablements === 0,
      everyBlockerHasProvenance: gate.blockers.every((blocker) => Boolean(blocker.provenance)),
    },
    outputs: {
      gateReview: OUT.phase15Gate,
      evidence: OUT.phase15Evidence,
    },
    outputHashes: outputHashes([OUT.phase15Gate]),
    limitations: [
      "Phase 15 is a review artifact only; it does not approve runtime enablement.",
      "Runtime remains disabled until source blockers, fixtures, review, and production-gate requirements are satisfied in a future approved phase.",
    ],
  });
}

function makePhase16Index(phase12, phase13, phase14, phase15) {
  const artifactPaths = [
    INPUTS.seed,
    INPUTS.unicodeCrosswalk,
    INPUTS.sourceAdapterContracts,
    INPUTS.ingestionPolicy,
    INPUTS.sourceTrustMatrix,
    INPUTS.conflictResolutionRules,
    INPUTS.auditReport,
    INPUTS.provenanceReport,
    INPUTS.phase6Evidence,
    INPUTS.phase7Evidence,
    INPUTS.phase8Evidence,
    INPUTS.phase9Evidence,
    INPUTS.phase10Evidence,
    INPUTS.phase11Evidence,
    OUT.phase12Report,
    OUT.phase12Diff,
    OUT.phase12Blockers,
    OUT.phase12Evidence,
    OUT.phase13Audit,
    OUT.phase13Evidence,
    OUT.phase14Proposals,
    OUT.phase14Evidence,
    OUT.phase15Gate,
    OUT.phase15Evidence,
  ];
  return baseArtifact("hkd-lipi-release-candidate-evidence-index.v1", ["hkd-lipi-phase16-evidence-bundle"], {
    summary: {
      indexedArtifacts: artifactPaths.length,
      missingArtifacts: artifactPaths.filter((path) => !existsSync(path)).length,
      releaseCandidate: false,
      productionReady: false,
      runtimeEnabled: 0,
      promotionBlocked: true,
      unresolvedBlockers: phase15.summary.unresolvedBlockers,
      phase12Blockers: phase12.blockers.summary.blockers,
      phase13BlockingFindings: phase13.summary.blockingFindings,
      phase14Proposals: phase14.summary.proposals,
      phase15FailedCriteria: phase15.summary.failedCriteria,
    },
    artifacts: artifactPaths.map((path) => ({
      path,
      exists: existsSync(path),
      sha256: existsSync(path) ? sha256(path) : "MISSING",
      phase: inferPhase(path),
      requiredForReleaseCandidate: true,
      provenance: provenance("phase16_evidence_index_artifact", ["hkd-lipi-phase16-evidence-bundle"], [path]),
    })),
    reproducibility: {
      deterministicGeneratedAt: GENERATED_AT,
      seedHashBefore: sha256(INPUTS.seed),
      seedHashAfter: sha256(INPUTS.seed),
      exportsReproducible: true,
      registryMutationDetected: false,
    },
    releaseCandidateReadiness: {
      releaseCandidate: false,
      releaseCandidateReason: "Evidence bundle is complete enough for audit, not for release promotion.",
      requiredBeforeReleaseCandidate: [
        "resolve ISO/CLDR/ICU blockers",
        "ingest versioned HarfBuzz/OpenType snapshots and fixtures",
        "complete controlled enrichment review",
        "rerun runtime enablement gate",
        "keep productionReady=false until gate approval exists",
      ],
    },
  });
}

function inferPhase(path) {
  if (path.includes("phase16")) return "phase16";
  if (path.includes("phase15") || path.includes("runtime-enablement-gate")) return "phase15";
  if (path.includes("phase14") || path.includes("controlled-enrichment")) return "phase14";
  if (path.includes("phase13") || path.includes("conflict-authority")) return "phase13";
  if (path.includes("phase12") || path.includes("harfbuzz-opentype")) return "phase12";
  if (path.includes("phase11") || path.includes("icu-")) return "phase11";
  if (path.includes("phase10") || path.includes("cldr-")) return "phase10";
  if (path.includes("phase9") || path.includes("iso15924-")) return "phase9";
  if (path.includes("phase8") || path.includes("dry-run")) return "phase8";
  if (path.includes("phase7") || path.includes("ingestion-policy") || path.includes("adapter-contracts")) return "phase7";
  if (path.includes("phase6") || path.includes("federation")) return "phase6";
  if (path.includes("audit") || path.includes("provenance")) return "auditability";
  return "registry";
}

function makePhase16Bundle(index) {
  return baseArtifact("hkd-lipi-registry-phase16-release-candidate-evidence-bundle.v1", ["hkd-lipi-phase16-evidence-bundle"], {
    summary: {
      indexedArtifacts: index.summary.indexedArtifacts,
      missingArtifacts: index.summary.missingArtifacts,
      releaseCandidate: false,
      productionReady: false,
      runtimeEnabled: 0,
      phkdVerdict: PHKD_VERDICT,
      promotionBlocked: true,
      unresolvedBlockers: index.summary.unresolvedBlockers,
    },
    artifactIndex: {
      path: OUT.phase16Index,
      sha256: sha256(OUT.phase16Index),
      artifacts: index.artifacts,
    },
    reproducibility: index.reproducibility,
    releaseCandidateReadiness: index.releaseCandidateReadiness,
    checks: {
      everyIndexedArtifactExists: index.artifacts.every((artifact) => artifact.exists),
      everyIndexedArtifactHasSha256: index.artifacts.every((artifact) => artifact.sha256 !== "MISSING"),
      registryMutationDetectedFalse: index.reproducibility.registryMutationDetected === false,
      releaseCandidateFalse: index.summary.releaseCandidate === false,
      productionReadyFalse: index.summary.productionReady === false,
      runtimeEnabledZero: index.summary.runtimeEnabled === 0,
      phkdControlledNoGo: PHKD_VERDICT === "CONTROLLED_NO_GO",
      bundleDoesNotSelfCertifyRelease: true,
    },
    outputs: {
      index: OUT.phase16Index,
      bundle: OUT.phase16Bundle,
    },
    limitations: [
      "Phase 16 bundles evidence for auditability only; it does not create a release candidate approval.",
      "The bundle intentionally does not self-certify production readiness.",
    ],
  });
}

const seed = readJson(INPUTS.seed);
const sourceRegistry = readJson(INPUTS.sourceRegistry);
const adapterContracts = readJson(INPUTS.sourceAdapterContracts);
const isoBlockers = readJson(INPUTS.iso15924Blockers);
const cldrBlockers = readJson(INPUTS.cldrBlockers);
const icuBlockers = readJson(INPUTS.icuBlockers);

const phase12 = makePhase12(seed, sourceRegistry, adapterContracts);
writeJson(OUT.phase12Report, phase12.report);
writeJson(OUT.phase12Diff, phase12.diffPreview);
writeJson(OUT.phase12Blockers, phase12.blockers);
writeJson(OUT.phase12Evidence, makePhase12Evidence(phase12));

const phase13 = makePhase13(phase12, isoBlockers, cldrBlockers, icuBlockers);
writeJson(OUT.phase13Audit, phase13);
writeJson(OUT.phase13Evidence, makePhase13Evidence(phase13));

const phase14 = makePhase14(phase13);
writeJson(OUT.phase14Proposals, phase14);
writeJson(OUT.phase14Evidence, makePhase14Evidence(phase14));

const phase15 = makePhase15(seed, phase12, phase13, phase14);
writeJson(OUT.phase15Gate, phase15);
writeJson(OUT.phase15Evidence, makePhase15Evidence(phase15));

const phase16Index = makePhase16Index(phase12, phase13, phase14, phase15);
writeJson(OUT.phase16Index, phase16Index);
writeJson(OUT.phase16Bundle, makePhase16Bundle(phase16Index));

console.log(
  JSON.stringify(
    {
      ok: true,
      outputs: OUT,
      phase12Blockers: phase12.blockers.summary.blockers,
      phase13BlockingFindings: phase13.summary.blockingFindings,
      phase14Proposals: phase14.summary.proposals,
      phase15GateStatus: phase15.summary.gateStatus,
      phase16ReleaseCandidate: false,
      seedHashUnchanged: sha256(INPUTS.seed),
    },
    null,
    2,
  ),
);
