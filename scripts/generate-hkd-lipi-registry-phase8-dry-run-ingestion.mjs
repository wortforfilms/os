import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const INPUTS = {
  seed: "data/hkd-lipi-script-registry-seed-426.json",
  adapterContracts: "data/hkd-lipi-source-adapter-contracts.json",
  ingestionPolicy: "data/hkd-lipi-ingestion-policy.json",
  trustMatrix: "data/hkd-lipi-source-trust-matrix.json",
  conflictRules: "data/hkd-lipi-conflict-resolution-rules.json",
  phase7Evidence: "release/evidence/hkd-lipi-registry-phase7-ingestion-contracts.json",
};

const OUT = {
  dryRunReport: "data/hkd-lipi-ingestion-dry-run-report.json",
  fieldDiffPreview: "data/hkd-lipi-ingestion-field-diff-preview.json",
  blockers: "data/hkd-lipi-ingestion-blockers.json",
  evidence: "release/evidence/hkd-lipi-registry-phase8-dry-run-ingestion.json",
};

const GENERATED_AT = "DETERMINISTIC_FROM_PHASE7_CONTRACT_INPUTS";
const GENERATED_BY = "scripts/generate-hkd-lipi-registry-phase8-dry-run-ingestion.mjs";
const REVIEW_STATE = "CONTROLLED_NO_GO";
const PHKD_VERDICT = "CONTROLLED_NO_GO";
const GOVERNED_PRODUCTION_GO = false;
const PRODUCTION_READY = false;
const RUNTIME_ENABLED = 0;
const SOURCE_POLICY = "dry_run_only_no_registry_mutation_no_enrichment";
const ALLOWED_FIELD_STATUSES = ["VERIFIED", "BLOCKED", "CONFLICT", "UNKNOWN"];

function read(path) {
  return readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

function sha256(path) {
  return createHash("sha256").update(read(path)).digest("hex");
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function slug(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function provenance(scope, sourceIds, inputPaths = Object.values(INPUTS)) {
  return {
    scope,
    sourceIds: unique(sourceIds),
    generatedBy: GENERATED_BY,
    sourcePolicy: SOURCE_POLICY,
    trustedInputs: unique(inputPaths),
    reviewed: false,
    phkd: "DRY_RUN_PREVIEW_ONLY_NO_RECORD_ENRICHMENT",
  };
}

function baseArtifact(schema, extra = {}) {
  return {
    schema,
    generatedAt: GENERATED_AT,
    reviewState: REVIEW_STATE,
    governedProductionGo: GOVERNED_PRODUCTION_GO,
    productionReady: PRODUCTION_READY,
    runtimeEnabled: RUNTIME_ENABLED,
    phkdVerdict: PHKD_VERDICT,
    sourcePolicy: SOURCE_POLICY,
    trustedInputs: Object.entries(INPUTS).map(([id, path]) => ({ id, path, sha256: sha256(path) })),
    provenance: provenance(schema, ["hkd-lipi-phase7-ingestion-contracts"]),
    ...extra,
  };
}

function previewForField(adapter, field) {
  const conflict = field.status === "CONFLICT";
  const blocked = field.status === "BLOCKED";
  const unknown = field.status === "UNKNOWN";
  const verified = field.status === "VERIFIED";
  const promotionBlockers = [];
  if (conflict) promotionBlockers.push("CONFLICT_BLOCKS_PROMOTION");
  if (blocked) promotionBlockers.push("FIELD_STATUS_BLOCKED");
  if (unknown) promotionBlockers.push("FIELD_STATUS_UNKNOWN");
  if (!verified) promotionBlockers.push("NO_VERIFIED_FIELD_EVIDENCE");

  return {
    id: `phase8:preview:${slug(adapter.sourceId)}:${slug(field.field)}`,
    adapterId: adapter.id,
    sourceId: adapter.sourceId,
    field: field.field,
    adapterFieldStatus: field.status,
    diffKind: verified ? "VERIFIED_NO_REGISTRY_DIFF" : conflict ? "CONFLICT_NO_REGISTRY_DIFF" : blocked ? "BLOCKED_NO_REGISTRY_DIFF" : "UNKNOWN_NO_REGISTRY_DIFF",
    currentRegistryValue: "UNCHANGED",
    proposedRegistryValue: "NO_REGISTRY_VALUE_PROPOSED",
    proposedFieldChange: false,
    previewOnly: true,
    wouldMutateRegistry: false,
    wouldEnrichRow: false,
    wouldEnableRuntime: false,
    promotionEligible: verified && promotionBlockers.length === 0,
    promotionBlockers,
    reason: field.reason,
    provenance: provenance("dry_run_field_diff_preview", [adapter.sourceId, "hkd-lipi-phase7-ingestion-contracts"]),
  };
}

function blockerFromPreview(preview) {
  return {
    id: `phase8:blocker:${slug(preview.sourceId)}:${slug(preview.field)}`,
    sourceId: preview.sourceId,
    adapterId: preview.adapterId,
    field: preview.field,
    severity: preview.adapterFieldStatus === "CONFLICT" ? "HIGH" : preview.adapterFieldStatus === "BLOCKED" ? "MEDIUM" : "LOW",
    status: preview.adapterFieldStatus,
    blocksPromotion: true,
    reason: preview.reason,
    requiredToUnblock:
      preview.adapterFieldStatus === "CONFLICT"
        ? ["resolve conflict report", "attach source-chain review", "explicit reviewer decision"]
        : preview.adapterFieldStatus === "UNKNOWN"
          ? ["attach authoritative local snapshot", "map source field to registry field", "human review"]
          : ["satisfy adapter prerequisite", "attach field-level provenance", "rerun dry-run harness"],
    provenance: provenance("dry_run_ingestion_blocker", [preview.sourceId, "hkd-lipi-phase7-ingestion-contracts"]),
  };
}

function makeGlobalBlockers(conflictRules) {
  return [
    {
      id: "phase8:blocker:dry-run-only",
      sourceId: "hkd-lipi-phase8-harness",
      adapterId: "dry-run-harness",
      field: "registry_mutation",
      severity: "HIGH",
      status: "BLOCKED",
      blocksPromotion: true,
      reason: "Phase 8 is dry-run only; registry mutation is out of scope.",
      requiredToUnblock: ["new approved phase", "write-mode policy", "reviewed migration plan"],
      provenance: provenance("dry_run_global_blocker", ["hkd-lipi-phase7-ingestion-contracts"]),
    },
    {
      id: "phase8:blocker:conflicts-block-promotion",
      sourceId: "hkd-lipi-phase8-harness",
      adapterId: "dry-run-harness",
      field: "promotion_gate",
      severity: "HIGH",
      status: "BLOCKED",
      blocksPromotion: true,
      reason: "Conflict-resolution rules require every conflict to block promotion and never auto-apply.",
      requiredToUnblock: conflictRules.rules
        .filter((rule) => rule.adapterFieldStatus === "CONFLICT")
        .flatMap((rule) => rule.resolutionRequires),
      provenance: provenance("dry_run_global_blocker", ["hkd-lipi-phase7-ingestion-contracts"]),
    },
  ];
}

function countBy(items, selectKey) {
  return items.reduce((acc, item) => {
    const key = selectKey(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function makeFieldDiffPreview(adapterContracts) {
  const previews = adapterContracts.adapters.flatMap((adapter) => adapter.fields.map((field) => previewForField(adapter, field)));
  const statusCounts = countBy(previews, (preview) => preview.adapterFieldStatus);
  return baseArtifact("hkd-lipi-ingestion-field-diff-preview.v1", {
    summary: {
      previews: previews.length,
      proposedFieldChanges: previews.filter((preview) => preview.proposedFieldChange).length,
      previewOnlyRows: previews.filter((preview) => preview.previewOnly).length,
      registryMutations: previews.filter((preview) => preview.wouldMutateRegistry).length,
      enrichedRows: previews.filter((preview) => preview.wouldEnrichRow).length,
      runtimeEnablements: previews.filter((preview) => preview.wouldEnableRuntime).length,
      promotionEligiblePreviews: previews.filter((preview) => preview.promotionEligible).length,
      statusCounts: Object.fromEntries(ALLOWED_FIELD_STATUSES.map((status) => [status, statusCounts[status] ?? 0])),
    },
    previews,
  });
}

function makeBlockers(fieldDiffPreview, conflictRules) {
  const fieldBlockers = fieldDiffPreview.previews.filter((preview) => preview.adapterFieldStatus !== "VERIFIED").map(blockerFromPreview);
  const globalBlockers = makeGlobalBlockers(conflictRules);
  const blockers = [...globalBlockers, ...fieldBlockers];
  return baseArtifact("hkd-lipi-ingestion-blockers.v1", {
    summary: {
      blockers: blockers.length,
      fieldBlockers: fieldBlockers.length,
      globalBlockers: globalBlockers.length,
      conflictBlockers: blockers.filter((blocker) => blocker.status === "CONFLICT").length,
      blockedStatusBlockers: blockers.filter((blocker) => blocker.status === "BLOCKED").length,
      unknownStatusBlockers: blockers.filter((blocker) => blocker.status === "UNKNOWN").length,
      highSeverity: blockers.filter((blocker) => blocker.severity === "HIGH").length,
      promotionBlocked: blockers.some((blocker) => blocker.blocksPromotion),
    },
    conflictPromotionPolicy: {
      conflictsDetected: fieldBlockers.filter((blocker) => blocker.status === "CONFLICT").length,
      promotionAllowedWhenConflict: false,
      enforced: true,
      rule: "ANY_CONFLICT_BLOCKS_PROMOTION",
    },
    blockers,
  });
}

function makeDryRunReport(seed, adapterContracts, ingestionPolicy, trustMatrix, conflictRules, fieldDiffPreview, blockers, seedHashBefore) {
  const adapterRuns = adapterContracts.adapters.map((adapter) => {
    const previews = fieldDiffPreview.previews.filter((preview) => preview.adapterId === adapter.id);
    const adapterBlockers = blockers.blockers.filter((blocker) => blocker.adapterId === adapter.id);
    return {
      id: `phase8:run:${slug(adapter.sourceId)}`,
      adapterId: adapter.id,
      sourceId: adapter.sourceId,
      mode: "DRY_RUN_ONLY",
      status: "DRY_RUN_COMPLETE",
      rowsRead: seed.records.length,
      rowsWritten: 0,
      enrichedRows: 0,
      runtimeEnablements: 0,
      fieldPreviewCount: previews.length,
      proposedFieldChanges: previews.filter((preview) => preview.proposedFieldChange).length,
      blockers: adapterBlockers.length,
      conflicts: previews.filter((preview) => preview.adapterFieldStatus === "CONFLICT").length,
      promotionStatus: adapterBlockers.length > 0 ? "BLOCKED" : "PREVIEW_ONLY",
      provenance: provenance("dry_run_adapter_execution", [adapter.sourceId, "hkd-lipi-phase7-ingestion-contracts"]),
    };
  });
  return baseArtifact("hkd-lipi-ingestion-dry-run-report.v1", {
    dryRun: {
      mode: "DRY_RUN_ONLY",
      inputSeedRows: seed.records.length,
      adaptersRun: adapterRuns.length,
      rowsRead: seed.records.length,
      rowsWritten: 0,
      enrichedRows: 0,
      runtimeEnabledRowsBefore: seed.records.filter((record) => record.hkd_runtime_enabled === true).length,
      runtimeEnabledRowsAfterPreview: 0,
      proposedFieldChanges: fieldDiffPreview.summary.proposedFieldChanges,
      fieldDiffPreviews: fieldDiffPreview.summary.previews,
      blockers: blockers.summary.blockers,
      conflicts: blockers.summary.conflictBlockers,
      promotionStatus: "BLOCKED",
      promotionBlockedBy: ["DRY_RUN_ONLY", "BLOCKED_OR_UNKNOWN_FIELD_PREVIEWS", "NO_REGISTRY_WRITE_POLICY"],
      conflictsBlockPromotion: true,
      seedHashBefore,
      seedHashAfter: sha256(INPUTS.seed),
    },
    policySnapshot: {
      adapterMode: ingestionPolicy.adapterMode,
      registryMutationAllowed: ingestionPolicy.registryMutationAllowed,
      silentEnrichmentAllowed: ingestionPolicy.silentEnrichmentAllowed,
      conflictRulesAutoApply: conflictRules.summary.autoApplyRules,
      trustMatrixWritesRegistryRows: trustMatrix.summary.writesRegistryRows,
    },
    adapterRuns,
  });
}

function main() {
  const seedHashBefore = sha256(INPUTS.seed);
  const seed = readJson(INPUTS.seed);
  const adapterContracts = readJson(INPUTS.adapterContracts);
  const ingestionPolicy = readJson(INPUTS.ingestionPolicy);
  const trustMatrix = readJson(INPUTS.trustMatrix);
  const conflictRules = readJson(INPUTS.conflictRules);
  const phase7Evidence = readJson(INPUTS.phase7Evidence);
  const fieldDiffPreview = makeFieldDiffPreview(adapterContracts);
  const blockers = makeBlockers(fieldDiffPreview, conflictRules);
  const dryRunReport = makeDryRunReport(seed, adapterContracts, ingestionPolicy, trustMatrix, conflictRules, fieldDiffPreview, blockers, seedHashBefore);

  const evidence = baseArtifact("hkd-lipi-registry-phase8-dry-run-ingestion.v1", {
    counts: {
      seedRecords: seed.records.length,
      adaptersRun: dryRunReport.dryRun.adaptersRun,
      fieldDiffPreviews: fieldDiffPreview.summary.previews,
      proposedFieldChanges: fieldDiffPreview.summary.proposedFieldChanges,
      blockers: blockers.summary.blockers,
      conflicts: blockers.summary.conflictBlockers,
      rowsWritten: dryRunReport.dryRun.rowsWritten,
      enrichedRows: dryRunReport.dryRun.enrichedRows,
      runtimeEnablements: dryRunReport.dryRun.runtimeEnabledRowsAfterPreview,
    },
    checks: {
      phase7ContractsPassed: phase7Evidence.checks.noAdaptersWriteRegistry === true && phase7Evidence.checks.noSilentEnrichment === true,
      dryRunModeOnly: dryRunReport.dryRun.mode === "DRY_RUN_ONLY" && dryRunReport.adapterRuns.every((run) => run.mode === "DRY_RUN_ONLY"),
      noRegistryMutation: dryRunReport.dryRun.rowsWritten === 0 && dryRunReport.dryRun.seedHashBefore === dryRunReport.dryRun.seedHashAfter,
      noEnrichedRows: dryRunReport.dryRun.enrichedRows === 0 && fieldDiffPreview.summary.enrichedRows === 0,
      noRuntimeEnablement: dryRunReport.dryRun.runtimeEnabledRowsAfterPreview === 0 && fieldDiffPreview.summary.runtimeEnablements === 0,
      everyProposedFieldChangePreviewOnly: fieldDiffPreview.previews.every((preview) => preview.previewOnly === true && preview.wouldMutateRegistry === false),
      conflictsBlockPromotion: blockers.conflictPromotionPolicy.promotionAllowedWhenConflict === false && blockers.conflictPromotionPolicy.enforced === true,
      promotionBlocked: dryRunReport.dryRun.promotionStatus === "BLOCKED" && blockers.summary.promotionBlocked === true,
      noProductionReadyTrue: PRODUCTION_READY === false,
      allOutputsHaveProvenance: [dryRunReport, fieldDiffPreview, blockers].every((artifact) => artifact.provenance?.sourceIds?.length > 0),
    },
    outputs: OUT,
    limitations: [
      "Phase 8 runs adapter contracts in dry-run mode only.",
      "Field previews are status/evidence previews, not registry value writes.",
      "No enriched registry rows are emitted.",
      "Any future conflict must block promotion until reviewed.",
    ],
  });

  writeFileSync(OUT.dryRunReport, `${JSON.stringify(dryRunReport, null, 2)}\n`);
  writeFileSync(OUT.fieldDiffPreview, `${JSON.stringify(fieldDiffPreview, null, 2)}\n`);
  writeFileSync(OUT.blockers, `${JSON.stringify(blockers, null, 2)}\n`);
  writeFileSync(OUT.evidence, `${JSON.stringify(evidence, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        generated: OUT,
        counts: evidence.counts,
        checks: evidence.checks,
      },
      null,
      2,
    ),
  );
}

main();
