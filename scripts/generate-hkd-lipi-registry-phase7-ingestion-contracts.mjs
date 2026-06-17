import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const INPUTS = {
  seed: "data/hkd-lipi-script-registry-seed-426.json",
  sourceRegistry: "data/hkd-lipi-federated-source-registry.json",
  phase6Evidence: "release/evidence/hkd-lipi-registry-phase6-federation.json",
};

const OUT = {
  adapterContracts: "data/hkd-lipi-source-adapter-contracts.json",
  ingestionPolicy: "data/hkd-lipi-ingestion-policy.json",
  trustMatrix: "data/hkd-lipi-source-trust-matrix.json",
  conflictRules: "data/hkd-lipi-conflict-resolution-rules.json",
  evidence: "release/evidence/hkd-lipi-registry-phase7-ingestion-contracts.json",
};

const GENERATED_AT = "DETERMINISTIC_FROM_PHASE6_FEDERATION_INPUTS";
const GENERATED_BY = "scripts/generate-hkd-lipi-registry-phase7-ingestion-contracts.mjs";
const REVIEW_STATE = "CONTROLLED_NO_GO";
const PHKD_VERDICT = "CONTROLLED_NO_GO";
const GOVERNED_PRODUCTION_GO = false;
const PRODUCTION_READY = false;
const RUNTIME_ENABLED = 0;
const SOURCE_POLICY = "adapter_contracts_only_no_ingestion_no_silent_enrichment";
const ALLOWED_FIELD_STATUSES = ["VERIFIED", "BLOCKED", "CONFLICT", "UNKNOWN"];
const ADAPTER_SOURCE_IDS = ["iso-15924", "cldr", "icu", "harfbuzz", "opentype-spec"];

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

function provenance(scope, sourceIds, inputPaths = Object.values(INPUTS)) {
  return {
    scope,
    sourceIds: unique(sourceIds),
    generatedBy: GENERATED_BY,
    sourcePolicy: SOURCE_POLICY,
    trustedInputs: unique(inputPaths),
    reviewed: false,
    phkd: "CONTRACT_FACTS_ONLY_NO_RECORD_ENRICHMENT",
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
    allowedFieldStatuses: ALLOWED_FIELD_STATUSES,
    trustedInputs: Object.entries(INPUTS).map(([id, path]) => ({ id, path, sha256: sha256(path) })),
    provenance: provenance(schema, ["hkd-lipi-phase6-federation"]),
    ...extra,
  };
}

function getSource(sourceRegistry, id) {
  const source = sourceRegistry.sources.find((entry) => entry.id === id);
  if (!source) throw new Error(`Missing federated source ${id}`);
  return source;
}

function field(field, status, reason, validationScope, authority) {
  if (!ALLOWED_FIELD_STATUSES.includes(status)) throw new Error(`Invalid adapter field status ${status}`);
  return {
    field,
    status,
    validationScope,
    authority,
    writePolicy: "NO_WRITE",
    failureMode: status === "VERIFIED" ? "EVIDENCE_ONLY" : "FAIL_CLOSED",
    reason,
  };
}

function adapter(sourceRegistry, spec) {
  const source = getSource(sourceRegistry, spec.sourceId);
  const fields = spec.fields.map((entry) => field(...entry));
  return {
    id: `adapter:${spec.sourceId}`,
    sourceId: spec.sourceId,
    displayName: spec.displayName,
    sourceLocalStatus: source.localStatus,
    mode: "VALIDATE_ONLY",
    contractStatus: spec.contractStatus,
    allowedFieldStatuses: ALLOWED_FIELD_STATUSES,
    writesRegistry: false,
    registryMutationAllowed: false,
    silentEnrichmentAllowed: false,
    createsNewScriptClaims: false,
    runtimeEnablementAllowed: false,
    productionReadyAllowed: false,
    permittedOperations: ["READ_LOCAL_SNAPSHOT", "VALIDATE_EXISTING_FIELD", "EMIT_FIELD_STATUS", "EMIT_CONFLICT_REPORT"],
    forbiddenOperations: [
      "CREATE_SCRIPT_ROW",
      "ASSIGN_UNICODE",
      "ASSIGN_ISO15924",
      "ASSIGN_FONT_SUPPORT",
      "ASSIGN_TRANSLITERATION",
      "SET_RUNTIME_ENABLED",
      "SET_PRODUCTION_READY",
      "WRITE_REGISTRY_FIELD",
      "SILENT_ENRICH_RECORD",
    ],
    prerequisites: spec.prerequisites,
    fields,
    provenance: provenance("source_adapter_contract", [spec.sourceId, "hkd-lipi-phase6-federation"]),
  };
}

function makeAdapters(sourceRegistry) {
  return [
    adapter(sourceRegistry, {
      sourceId: "iso-15924",
      displayName: "ISO 15924 validate-only adapter contract",
      contractStatus: "BLOCKED_UNTIL_STANDALONE_CODE_LIST_SNAPSHOT",
      prerequisites: [
        "Versioned local ISO 15924 code-list snapshot",
        "Snapshot checksum",
        "Explicit field-diff report against current registry",
        "Human review before any verified field transition",
      ],
      fields: [
        [
          "unicode_script_alias_cross_check",
          "VERIFIED",
          "Current checkpoint can only cross-check aliases already present in UCD PropertyValueAliases; it cannot assign new ISO values.",
          "existing_unicode_rows_only",
          "unicode-ucd",
        ],
        [
          "iso15924_alpha_code",
          "BLOCKED",
          "No standalone ISO 15924 code-list snapshot is locally ingested.",
          "no_new_assignment",
          "iso-15924",
        ],
        [
          "iso15924_numeric_code",
          "BLOCKED",
          "Numeric ISO 15924 codes are not represented in the registry seed and no local ISO snapshot exists.",
          "no_new_assignment",
          "iso-15924",
        ],
        [
          "new_script_code_assignment",
          "BLOCKED",
          "Adapters may not create or assign script codes.",
          "no_new_script_claims",
          "iso-15924",
        ],
      ],
    }),
    adapter(sourceRegistry, {
      sourceId: "cldr",
      displayName: "CLDR validate-only adapter contract",
      contractStatus: "BLOCKED_UNTIL_LOCAL_CLDR_SNAPSHOT",
      prerequisites: [
        "Versioned local CLDR data snapshot",
        "Locale-to-script field map",
        "No write mode",
        "Conflict report for exemplar, collation, transform, and numbering data",
      ],
      fields: [
        ["locale_exemplar_sets", "BLOCKED", "No CLDR snapshot is locally ingested.", "future_validation_only", "cldr"],
        ["collation_data", "BLOCKED", "No CLDR snapshot is locally ingested.", "future_validation_only", "cldr"],
        ["numbering_systems", "BLOCKED", "No CLDR snapshot is locally ingested.", "future_validation_only", "cldr"],
        ["transforms_transliteration", "BLOCKED", "No CLDR transform data is locally ingested; do not infer transliteration.", "future_validation_only", "cldr"],
      ],
    }),
    adapter(sourceRegistry, {
      sourceId: "icu",
      displayName: "ICU validate-only adapter contract",
      contractStatus: "BLOCKED_UNTIL_LOCAL_ICU_VERSIONED_SNAPSHOT",
      prerequisites: [
        "Versioned ICU data/API snapshot",
        "Deterministic test harness",
        "Explicit mapping from implementation behavior to registry fields",
        "No script-fact assignment from implementation behavior",
      ],
      fields: [
        ["normalization_behavior", "BLOCKED", "No ICU snapshot or deterministic API trace is locally ingested.", "future_validation_only", "icu"],
        ["collation_behavior", "BLOCKED", "No ICU snapshot or deterministic API trace is locally ingested.", "future_validation_only", "icu"],
        ["break_iterator_behavior", "BLOCKED", "No ICU snapshot or deterministic API trace is locally ingested.", "future_validation_only", "icu"],
        ["script_detection_behavior", "UNKNOWN", "Implementation behavior may be testable later, but cannot create script identity claims.", "future_validation_only", "icu"],
      ],
    }),
    adapter(sourceRegistry, {
      sourceId: "harfbuzz",
      displayName: "HarfBuzz validate-only adapter contract",
      contractStatus: "BLOCKED_UNTIL_SHAPING_CORPUS_AND_VERSIONED_BINARY",
      prerequisites: [
        "Versioned HarfBuzz binary or source snapshot",
        "Versioned font fixtures",
        "Script-specific shaping corpus",
        "Visual or glyph-run diff report",
      ],
      fields: [
        ["joining_behavior", "BLOCKED", "No shaping corpus or versioned HarfBuzz snapshot is locally ingested.", "future_validation_only", "harfbuzz"],
        ["complex_shaping_behavior", "BLOCKED", "No shaping corpus or versioned HarfBuzz snapshot is locally ingested.", "future_validation_only", "harfbuzz"],
        ["glyph_substitution_behavior", "BLOCKED", "No font fixtures or glyph-run evidence is locally ingested.", "future_validation_only", "harfbuzz"],
        ["font_support_status", "BLOCKED", "HarfBuzz shaping results cannot prove font availability without versioned font evidence.", "future_validation_only", "harfbuzz"],
      ],
    }),
    adapter(sourceRegistry, {
      sourceId: "opentype-spec",
      displayName: "OpenType specification validate-only adapter contract",
      contractStatus: "BLOCKED_UNTIL_LOCAL_SPEC_AND_FONT_FIXTURES",
      prerequisites: [
        "Versioned local OpenType specification snapshot",
        "Feature-tag policy map",
        "Versioned font fixtures",
        "Human-reviewed mapping from spec feature to registry field",
      ],
      fields: [
        ["opentype_feature_support", "BLOCKED", "No local specification snapshot or font fixture evidence is ingested.", "future_validation_only", "opentype-spec"],
        ["font_table_support", "BLOCKED", "No font fixture evidence is ingested.", "future_validation_only", "opentype-spec"],
        ["font_support_status", "BLOCKED", "The specification does not prove actual installed font support.", "future_validation_only", "opentype-spec"],
        ["rendering_engine_support", "UNKNOWN", "A spec relationship alone cannot verify runtime rendering support.", "future_validation_only", "opentype-spec"],
      ],
    }),
  ];
}

function makePolicy(adapters) {
  return baseArtifact("hkd-lipi-ingestion-policy.v1", {
    policyId: "hkd-lipi-phase7-validate-only-ingestion-policy",
    scope: "source_adapter_contracts_before_claim_ingestion",
    adapterMode: "VALIDATE_ONLY",
    registryMutationAllowed: false,
    silentEnrichmentAllowed: false,
    createsNewScriptClaims: false,
    runtimeEnablementAllowed: false,
    productionReadyAllowed: false,
    allowedAdapterFieldStatuses: ALLOWED_FIELD_STATUSES,
    allowedActions: ["mark_field_VERIFIED_with_existing_evidence", "mark_field_BLOCKED", "mark_field_CONFLICT", "mark_field_UNKNOWN", "emit_audit_artifact"],
    forbiddenActions: [
      "auto_apply_verified_field_to_registry",
      "create_or_delete_script_record",
      "invent_unicode_assignment",
      "invent_iso15924_code",
      "invent_font_support",
      "invent_transliteration_mapping",
      "set_runtime_enabled_true",
      "set_production_ready_true",
    ],
    fieldTransitionPolicy: [
      {
        from: "UNKNOWN",
        to: "VERIFIED",
        registryWriteAllowed: false,
        requirements: ["authoritative local snapshot", "field-level provenance", "conflict detector clean", "human review"],
      },
      {
        from: "BLOCKED",
        to: "VERIFIED",
        registryWriteAllowed: false,
        requirements: ["blocking prerequisite satisfied", "field-level provenance", "human review", "review note"],
      },
      {
        from: "CONFLICT",
        to: "VERIFIED",
        registryWriteAllowed: false,
        requirements: ["conflict-resolution rule applied", "human review", "review note", "explicit evidence chain"],
      },
    ],
    adapterSummary: adapters.map((entry) => ({
      id: entry.id,
      sourceId: entry.sourceId,
      mode: entry.mode,
      writesRegistry: entry.writesRegistry,
      silentEnrichmentAllowed: entry.silentEnrichmentAllowed,
      createsNewScriptClaims: entry.createsNewScriptClaims,
      contractStatus: entry.contractStatus,
    })),
  });
}

function matrixRow(sourceRegistry, sourceId, fieldGroups) {
  const source = getSource(sourceRegistry, sourceId);
  return {
    sourceId,
    displayName: source.displayName,
    sourceLocalStatus: source.localStatus,
    writesRegistry: false,
    silentEnrichmentAllowed: false,
    createsNewScriptClaims: false,
    fieldGroups: fieldGroups.map(([fieldGroup, status, trustUse, blockedReason]) => ({
      fieldGroup,
      status,
      trustUse,
      blockedReason,
      provenance: provenance("source_trust_matrix_field_group", [sourceId, "hkd-lipi-phase6-federation"]),
    })),
    provenance: provenance("source_trust_matrix_row", [sourceId, "hkd-lipi-phase6-federation"]),
  };
}

function makeTrustMatrix(sourceRegistry) {
  const rows = [
    matrixRow(sourceRegistry, "unicode-ucd", [
      ["unicode_script_property", "VERIFIED", "trusted_current_input", "NONE"],
      ["unicode_blocks", "VERIFIED", "trusted_current_input", "NONE"],
      ["unicode_ranges", "VERIFIED", "trusted_current_input", "NONE"],
      ["decimal_digits_and_zero", "VERIFIED", "trusted_current_input", "NONE"],
      ["font_support", "BLOCKED", "not_authoritative_for_field", "UCD does not prove font support."],
    ]),
    matrixRow(sourceRegistry, "iso-15924", [
      ["unicode_script_alias_cross_check", "VERIFIED", "ucd_alias_only", "NONE"],
      ["iso15924_alpha_code", "BLOCKED", "future_iso_snapshot_validation", "Standalone ISO 15924 snapshot not locally ingested."],
      ["iso15924_numeric_code", "BLOCKED", "future_iso_snapshot_validation", "Standalone ISO 15924 snapshot not locally ingested."],
      ["new_code_assignment", "BLOCKED", "never_auto_assign", "Adapters cannot assign script codes."],
    ]),
    matrixRow(sourceRegistry, "cldr", [
      ["locale_exemplar_sets", "BLOCKED", "future_validation_only", "CLDR snapshot not locally ingested."],
      ["collation", "BLOCKED", "future_validation_only", "CLDR snapshot not locally ingested."],
      ["numbering_systems", "BLOCKED", "future_validation_only", "CLDR snapshot not locally ingested."],
      ["transforms", "BLOCKED", "future_validation_only", "CLDR snapshot not locally ingested."],
    ]),
    matrixRow(sourceRegistry, "icu", [
      ["normalization_behavior", "BLOCKED", "future_validation_only", "ICU snapshot not locally ingested."],
      ["collation_behavior", "BLOCKED", "future_validation_only", "ICU snapshot not locally ingested."],
      ["script_detection_behavior", "UNKNOWN", "future_validation_only", "Implementation behavior cannot create script identity claims."],
    ]),
    matrixRow(sourceRegistry, "harfbuzz", [
      ["shaping_behavior", "BLOCKED", "future_validation_only", "HarfBuzz snapshot and shaping corpus not locally ingested."],
      ["glyph_run_behavior", "BLOCKED", "future_validation_only", "Font fixtures and glyph-run evidence not locally ingested."],
      ["font_support", "BLOCKED", "not_authoritative_for_field", "HarfBuzz output cannot prove installed font availability by itself."],
    ]),
    matrixRow(sourceRegistry, "opentype-spec", [
      ["feature_tags", "BLOCKED", "future_validation_only", "OpenType spec snapshot not locally ingested."],
      ["font_table_support", "BLOCKED", "future_validation_only", "Font fixtures not locally ingested."],
      ["font_support", "BLOCKED", "not_authoritative_for_field", "Specification does not prove actual font support."],
      ["rendering_engine_support", "UNKNOWN", "future_validation_only", "Spec relationships cannot verify runtime behavior by themselves."],
    ]),
  ];
  const statuses = rows.flatMap((row) => row.fieldGroups.map((group) => group.status));
  return baseArtifact("hkd-lipi-source-trust-matrix.v1", {
    summary: {
      sources: rows.length,
      fieldGroups: statuses.length,
      verifiedFieldGroups: statuses.filter((status) => status === "VERIFIED").length,
      blockedFieldGroups: statuses.filter((status) => status === "BLOCKED").length,
      conflictFieldGroups: statuses.filter((status) => status === "CONFLICT").length,
      unknownFieldGroups: statuses.filter((status) => status === "UNKNOWN").length,
      writesRegistryRows: rows.filter((row) => row.writesRegistry).length,
      silentEnrichmentRows: rows.filter((row) => row.silentEnrichmentAllowed).length,
    },
    rows,
  });
}

function makeConflictRules() {
  const rules = [
    {
      id: "conflict-does-not-write-registry",
      title: "A conflict report cannot mutate registry fields",
      trigger: "any adapter emits CONFLICT",
      adapterFieldStatus: "CONFLICT",
      autoApply: false,
      registryMutationAllowed: false,
      resolutionRequires: ["field-level evidence", "source-chain review", "explicit reviewer decision"],
      action: "emit_conflict_report_only",
    },
    {
      id: "non-ingested-source-cannot-verify",
      title: "A non-ingested source cannot verify current registry facts",
      trigger: "sourceLocalStatus is NOT_INGESTED",
      adapterFieldStatus: "BLOCKED",
      autoApply: false,
      registryMutationAllowed: false,
      resolutionRequires: ["versioned local source snapshot", "checksum", "adapter test"],
      action: "mark_field_BLOCKED",
    },
    {
      id: "ucd-controls-unicode-fields-only",
      title: "UCD evidence is authoritative for Unicode fields, not fonts or transliteration",
      trigger: "adapter references Unicode assignment, range, block, decimal digit, or zero glyph",
      adapterFieldStatus: "VERIFIED",
      autoApply: false,
      registryMutationAllowed: false,
      resolutionRequires: ["UCD provenance already present", "no external conflict"],
      action: "emit_verified_evidence_status_without_write",
    },
    {
      id: "iso-standalone-snapshot-required",
      title: "ISO 15924 assignments require a standalone ISO snapshot",
      trigger: "adapter attempts ISO alpha or numeric code validation",
      adapterFieldStatus: "BLOCKED",
      autoApply: false,
      registryMutationAllowed: false,
      resolutionRequires: ["standalone ISO 15924 local snapshot", "diff report", "human review"],
      action: "mark_iso_field_BLOCKED",
    },
    {
      id: "implementation-sources-do-not-create-script-claims",
      title: "ICU, HarfBuzz, and OpenType implementation/spec evidence cannot create script claims",
      trigger: "implementation or specification source references a missing registry field",
      adapterFieldStatus: "UNKNOWN",
      autoApply: false,
      registryMutationAllowed: false,
      resolutionRequires: ["existing registry row", "explicit field map", "human review"],
      action: "mark_field_UNKNOWN_or_BLOCKED",
    },
  ];

  return baseArtifact("hkd-lipi-conflict-resolution-rules.v1", {
    summary: {
      rules: rules.length,
      autoApplyRules: rules.filter((rule) => rule.autoApply).length,
      registryMutationRules: rules.filter((rule) => rule.registryMutationAllowed).length,
      allowedStatusesUsed: unique(rules.map((rule) => rule.adapterFieldStatus)),
    },
    rules: rules.map((rule) => ({
      ...rule,
      provenance: provenance("conflict_resolution_rule", ["hkd-lipi-phase6-federation"]),
    })),
  });
}

function main() {
  const seed = readJson(INPUTS.seed);
  const sourceRegistry = readJson(INPUTS.sourceRegistry);
  const phase6Evidence = readJson(INPUTS.phase6Evidence);
  const adapters = makeAdapters(sourceRegistry);
  const adapterFieldStatuses = adapters.flatMap((entry) => entry.fields.map((fieldEntry) => fieldEntry.status));
  const adapterContracts = baseArtifact("hkd-lipi-source-adapter-contracts.v1", {
    summary: {
      adapters: adapters.length,
      validateOnlyAdapters: adapters.filter((entry) => entry.mode === "VALIDATE_ONLY").length,
      writesRegistryAdapters: adapters.filter((entry) => entry.writesRegistry).length,
      registryMutationAdapters: adapters.filter((entry) => entry.registryMutationAllowed).length,
      silentEnrichmentAdapters: adapters.filter((entry) => entry.silentEnrichmentAllowed).length,
      createsNewScriptClaims: adapters.filter((entry) => entry.createsNewScriptClaims).length,
      adapterFields: adapterFieldStatuses.length,
      fieldStatuses: Object.fromEntries(ALLOWED_FIELD_STATUSES.map((status) => [status, adapterFieldStatuses.filter((entryStatus) => entryStatus === status).length])),
    },
    adapters,
  });
  const ingestionPolicy = makePolicy(adapters);
  const trustMatrix = makeTrustMatrix(sourceRegistry);
  const conflictRules = makeConflictRules();
  const evidence = baseArtifact("hkd-lipi-registry-phase7-ingestion-contracts.v1", {
    counts: {
      seedRecords: seed.records.length,
      phase6Sources: sourceRegistry.summary.sources,
      adapters: adapterContracts.summary.adapters,
      policyForbiddenActions: ingestionPolicy.forbiddenActions.length,
      trustMatrixRows: trustMatrix.summary.sources,
      conflictRules: conflictRules.summary.rules,
    },
    checks: {
      requestedAdaptersPresent: ADAPTER_SOURCE_IDS.every((sourceId) => adapters.some((entry) => entry.sourceId === sourceId)),
      onlyAllowedFieldStatuses: adapterFieldStatuses.every((status) => ALLOWED_FIELD_STATUSES.includes(status)),
      allAdaptersValidateOnly: adapters.every((entry) => entry.mode === "VALIDATE_ONLY"),
      noAdaptersWriteRegistry: adapters.every((entry) => entry.writesRegistry === false && entry.registryMutationAllowed === false),
      noSilentEnrichment: adapters.every((entry) => entry.silentEnrichmentAllowed === false) && ingestionPolicy.silentEnrichmentAllowed === false,
      noNewScriptClaims: adapters.every((entry) => entry.createsNewScriptClaims === false) && phase6Evidence.checks.noNewScriptClaimsCreated === true,
      noRuntimeEnabledTrue: seed.records.every((record) => record.hkd_runtime_enabled === false) && RUNTIME_ENABLED === 0,
      noProductionReadyTrue: PRODUCTION_READY === false && ingestionPolicy.productionReady === false,
      conflictRulesDoNotAutoApply: conflictRules.rules.every((rule) => rule.autoApply === false && rule.registryMutationAllowed === false),
      everyOutputHasProvenance: [adapterContracts, ingestionPolicy, trustMatrix, conflictRules].every((artifact) => artifact.provenance?.sourceIds?.length > 0),
    },
    outputs: OUT,
    limitations: [
      "No source adapter ingests external data in Phase 7.",
      "Adapters are contracts only and cannot silently enrich registry records.",
      "ISO 15924 remains blocked for standalone code-list validation until a local official snapshot is added.",
      "CLDR, ICU, HarfBuzz, and OpenType remain blocked until local versioned snapshots and tests exist.",
    ],
  });

  writeFileSync(OUT.adapterContracts, `${JSON.stringify(adapterContracts, null, 2)}\n`);
  writeFileSync(OUT.ingestionPolicy, `${JSON.stringify(ingestionPolicy, null, 2)}\n`);
  writeFileSync(OUT.trustMatrix, `${JSON.stringify(trustMatrix, null, 2)}\n`);
  writeFileSync(OUT.conflictRules, `${JSON.stringify(conflictRules, null, 2)}\n`);
  writeFileSync(OUT.evidence, `${JSON.stringify(evidence, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        generated: OUT,
        adapters: adapterContracts.summary.adapters,
        writesRegistryAdapters: adapterContracts.summary.writesRegistryAdapters,
        silentEnrichmentAdapters: adapterContracts.summary.silentEnrichmentAdapters,
        checks: evidence.checks,
      },
      null,
      2,
    ),
  );
}

main();
