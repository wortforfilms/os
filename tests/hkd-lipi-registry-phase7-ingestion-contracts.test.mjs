import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const adapterContracts = readJson("data/hkd-lipi-source-adapter-contracts.json");
const ingestionPolicy = readJson("data/hkd-lipi-ingestion-policy.json");
const trustMatrix = readJson("data/hkd-lipi-source-trust-matrix.json");
const conflictRules = readJson("data/hkd-lipi-conflict-resolution-rules.json");
const evidence = readJson("release/evidence/hkd-lipi-registry-phase7-ingestion-contracts.json");
const seed = readJson("data/hkd-lipi-script-registry-seed-426.json");

const requestedAdapterSources = ["iso-15924", "cldr", "icu", "harfbuzz", "opentype-spec"];
const allowedFieldStatuses = new Set(["VERIFIED", "BLOCKED", "CONFLICT", "UNKNOWN"]);
const forbiddenWriteWords = /WRITE_REGISTRY_FIELD|SILENT_ENRICH_RECORD|SET_RUNTIME_ENABLED|SET_PRODUCTION_READY|CREATE_SCRIPT_ROW|ASSIGN_UNICODE|ASSIGN_ISO15924/;

test("Phase 7 emits the requested adapter contract outputs as controlled no-go artifacts", () => {
  for (const artifact of [adapterContracts, ingestionPolicy, trustMatrix, conflictRules, evidence]) {
    assert.equal(artifact.reviewState, "CONTROLLED_NO_GO");
    assert.equal(artifact.governedProductionGo, false);
    assert.equal(artifact.productionReady, false);
    assert.equal(artifact.runtimeEnabled, 0);
    assert.equal(artifact.phkdVerdict, "CONTROLLED_NO_GO");
    assert.ok(artifact.provenance?.sourceIds?.length > 0, artifact.schema);
  }

  assert.equal(evidence.checks.noRuntimeEnabledTrue, true);
  assert.equal(evidence.checks.noProductionReadyTrue, true);
  assert.equal(seed.records.every((record) => record.hkd_runtime_enabled === false), true);
});

test("adapters are defined for ISO CLDR ICU HarfBuzz and OpenType only", () => {
  const adapterSourceIds = adapterContracts.adapters.map((adapter) => adapter.sourceId).sort();
  assert.deepEqual(adapterSourceIds, [...requestedAdapterSources].sort());
  assert.equal(adapterContracts.summary.adapters, requestedAdapterSources.length);
  assert.equal(adapterContracts.summary.validateOnlyAdapters, requestedAdapterSources.length);
  assert.equal(evidence.checks.requestedAdaptersPresent, true);
});

test("adapters may only mark fields as VERIFIED BLOCKED CONFLICT or UNKNOWN", () => {
  const fields = adapterContracts.adapters.flatMap((adapter) => adapter.fields.map((field) => ({ adapter, field })));
  assert.ok(fields.length > 0);

  for (const { adapter, field } of fields) {
    assert.equal(allowedFieldStatuses.has(field.status), true, `${adapter.sourceId}:${field.field}:${field.status}`);
    assert.equal(field.writePolicy, "NO_WRITE");
    assert.ok(field.reason);
  }
  assert.equal(evidence.checks.onlyAllowedFieldStatuses, true);
});

test("contracts cannot silently enrich or write the 426-row registry", () => {
  for (const adapter of adapterContracts.adapters) {
    assert.equal(adapter.mode, "VALIDATE_ONLY", adapter.sourceId);
    assert.equal(adapter.writesRegistry, false, adapter.sourceId);
    assert.equal(adapter.registryMutationAllowed, false, adapter.sourceId);
    assert.equal(adapter.silentEnrichmentAllowed, false, adapter.sourceId);
    assert.equal(adapter.createsNewScriptClaims, false, adapter.sourceId);
    assert.equal(adapter.runtimeEnablementAllowed, false, adapter.sourceId);
    assert.equal(adapter.productionReadyAllowed, false, adapter.sourceId);
    assert.ok(adapter.forbiddenOperations.some((operation) => forbiddenWriteWords.test(operation)), adapter.sourceId);
    assert.equal(adapter.permittedOperations.includes("VALIDATE_EXISTING_FIELD"), true, adapter.sourceId);
    assert.equal(adapter.permittedOperations.includes("EMIT_FIELD_STATUS"), true, adapter.sourceId);
  }

  assert.equal(adapterContracts.summary.writesRegistryAdapters, 0);
  assert.equal(adapterContracts.summary.registryMutationAdapters, 0);
  assert.equal(adapterContracts.summary.silentEnrichmentAdapters, 0);
  assert.equal(adapterContracts.summary.createsNewScriptClaims, 0);
  assert.equal(evidence.checks.noAdaptersWriteRegistry, true);
  assert.equal(evidence.checks.noSilentEnrichment, true);
  assert.equal(evidence.checks.noNewScriptClaims, true);
});

test("ingestion policy forbids invented Unicode ISO fonts and transliteration claims", () => {
  assert.equal(ingestionPolicy.adapterMode, "VALIDATE_ONLY");
  assert.equal(ingestionPolicy.registryMutationAllowed, false);
  assert.equal(ingestionPolicy.silentEnrichmentAllowed, false);
  assert.equal(ingestionPolicy.createsNewScriptClaims, false);
  assert.equal(ingestionPolicy.runtimeEnablementAllowed, false);
  assert.equal(ingestionPolicy.productionReadyAllowed, false);

  for (const action of [
    "invent_unicode_assignment",
    "invent_iso15924_code",
    "invent_font_support",
    "invent_transliteration_mapping",
    "auto_apply_verified_field_to_registry",
  ]) {
    assert.equal(ingestionPolicy.forbiddenActions.includes(action), true, action);
  }

  assert.equal(
    ingestionPolicy.fieldTransitionPolicy.every((transition) => transition.registryWriteAllowed === false && transition.requirements.includes("human review")),
    true,
  );
});

test("trust matrix keeps non-ingested sources blocked for current claim authority", () => {
  assert.equal(trustMatrix.summary.writesRegistryRows, 0);
  assert.equal(trustMatrix.summary.silentEnrichmentRows, 0);
  assert.equal(trustMatrix.summary.conflictFieldGroups, 0);

  for (const sourceId of ["cldr", "icu", "harfbuzz", "opentype-spec"]) {
    const row = trustMatrix.rows.find((entry) => entry.sourceId === sourceId);
    assert.ok(row, sourceId);
    assert.equal(row.sourceLocalStatus, "NOT_INGESTED", sourceId);
    assert.equal(row.writesRegistry, false, sourceId);
    assert.equal(row.silentEnrichmentAllowed, false, sourceId);
    assert.equal(row.createsNewScriptClaims, false, sourceId);
    assert.equal(row.fieldGroups.some((group) => group.status === "BLOCKED"), true, sourceId);
    assert.equal(row.fieldGroups.every((group) => allowedFieldStatuses.has(group.status)), true, sourceId);
  }

  const iso = trustMatrix.rows.find((entry) => entry.sourceId === "iso-15924");
  assert.ok(iso);
  assert.equal(iso.fieldGroups.some((group) => group.fieldGroup === "iso15924_alpha_code" && group.status === "BLOCKED"), true);
  assert.equal(iso.fieldGroups.some((group) => group.fieldGroup === "new_code_assignment" && group.status === "BLOCKED"), true);
});

test("conflict resolution rules are report-only and never auto-apply", () => {
  assert.equal(conflictRules.summary.rules > 0, true);
  assert.equal(conflictRules.summary.autoApplyRules, 0);
  assert.equal(conflictRules.summary.registryMutationRules, 0);

  for (const rule of conflictRules.rules) {
    assert.equal(allowedFieldStatuses.has(rule.adapterFieldStatus), true, rule.id);
    assert.equal(rule.autoApply, false, rule.id);
    assert.equal(rule.registryMutationAllowed, false, rule.id);
    assert.ok(rule.resolutionRequires.length > 0, rule.id);
    assert.ok(rule.provenance?.sourceIds?.length > 0, rule.id);
  }
  assert.equal(evidence.checks.conflictRulesDoNotAutoApply, true);
});

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
