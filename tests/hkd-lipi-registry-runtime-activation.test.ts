import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  getLipiPhase12To16GovernanceView,
  getLipiPhase17To19GovernanceView,
  getLipiRegistryRecords,
  getLipiRegistryRuntimeActivationView,
  getLipiRegistrySourceSummary,
} from "../src/lipi-registry/api.ts";

const artifactPath = "release/evidence/hkd-lipi-registry-runtime-activation.json";
const seedPath = "data/hkd-lipi-script-registry-seed-426.json";

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

test("runtime activation artifact declares controlled preview only", () => {
  const artifact = readJson(artifactPath);

  assert.equal(artifact.schema, "hkd-lipi-registry-runtime-activation.v1");
  assert.equal(artifact.registryRuntimeActive, true);
  assert.equal(artifact.runtimeMode, "CONTROLLED_PREVIEW");
  assert.equal(artifact.readOnly, true);
  assert.equal(artifact.mutationAllowed, false);
  assert.equal(artifact.productionReady, false);
  assert.equal(artifact.governedProductionGo, false);
  assert.equal(artifact.productionGoApproved, false);
  assert.equal(artifact.humanApprovalPresent, false);
  assert.equal(artifact.runtimeEnabledRows, 0);
  assert.equal(artifact.phkdVerdict, "CONTROLLED_PREVIEW_NO_GO");
});

test("runtime activation API exposes read-only preview without production promotion", () => {
  const view = getLipiRegistryRuntimeActivationView();

  assert.equal(view.ok, true);
  assert.equal(view.registryRuntimeActive, true);
  assert.equal(view.runtimeMode, "CONTROLLED_PREVIEW");
  assert.equal(view.readOnly, true);
  assert.equal(view.mutationAllowed, false);
  assert.equal(view.productionReady, false);
  assert.equal(view.governedProductionGo, false);
  assert.equal(view.productionGoApproved, false);
  assert.equal(view.humanApprovalPresent, false);
  assert.equal(view.runtimeEnabledRows, 0);
  assert.equal(view.releaseCandidate, false);
  assert.equal(view.phkdVerdict, "CONTROLLED_PREVIEW_NO_GO");
  assert.equal(view.runtimePolicy.registryMutationAllowed, false);
  assert.equal(view.runtimePolicy.rowRuntimeEnablementAllowed, false);
  assert.equal(view.runtimePolicy.enrichmentAutoApplyAllowed, false);
  assert.equal(view.runtimePolicy.productionGoAllowed, false);
});

test("registry rows remain immutable and runtime-disabled", () => {
  const view = getLipiRegistryRuntimeActivationView();
  const records = getLipiRegistryRecords();
  const seedHash = view.outputHashes.find((entry) => entry.path === seedPath)?.sha256;

  assert.equal(records.length, 426);
  assert.equal(records.every((record) => record.hkd_runtime_enabled === false), true);
  assert.equal(view.checks.noRegistryRowsChanged, true);
  assert.equal(view.registryMutations, 0);
  assert.equal(seedHash, sha256(seedPath));
});

test("controlled enrichment proposals are not auto-applied", () => {
  const view = getLipiRegistryRuntimeActivationView();
  const phases12To16 = getLipiPhase12To16GovernanceView();

  assert.equal(view.enrichmentAutoApplyAllowed, false);
  assert.equal(view.enrichmentProposalsApplied, 0);
  assert.equal(view.checks.noEnrichmentProposalApplied, true);
  assert.equal(phases12To16.phase14.proposals.summary.autoApply, 0);
  assert.equal(phases12To16.phase14.proposals.summary.registryMutations, 0);
  assert.equal(phases12To16.phase14.proposals.proposalPolicy.autoApplyAllowed, false);
});

test("production and release gates remain blocked after preview activation", () => {
  const view = getLipiRegistryRuntimeActivationView();
  const phases12To16 = getLipiPhase12To16GovernanceView();
  const phases17To19 = getLipiPhase17To19GovernanceView();

  assert.equal(phases12To16.phase15.gateReview.summary.runtimeEnablementApproved, false);
  assert.equal(phases12To16.phase15.gateReview.summary.runtimeEnabledRows, 0);
  assert.equal(phases12To16.phase16.evidenceBundle.summary.releaseCandidate, false);
  assert.equal(phases17To19.phase19.productionGoGate.summary.productionGoApproved, false);
  assert.equal(phases17To19.phase19.productionGoGate.summary.humanApprovalPresent, false);
  assert.equal(phases17To19.phase19.productionGoGate.summary.productionReady, false);
  assert.equal(view.checks.releaseCandidateFalse, true);
  assert.equal(view.checks.productionGoApprovedFalse, true);
  assert.equal(view.blockers.length > 0, true);
});

test("source summary includes the runtime activation contract and schema", () => {
  const sourceSummary = getLipiRegistrySourceSummary();

  assert.equal(sourceSummary.phase3Schemas.runtimeActivationEvidence, "hkd-lipi-registry-runtime-activation.v1");
  assert.equal(sourceSummary.runtimeActivationSourcePolicy, "controlled_preview_runtime_read_only_no_registry_mutation_no_production_go");
  assert.ok(sourceSummary.contracts.some((contract) => contract.path === "/api/lipi-registry/runtime-activation"));
});
