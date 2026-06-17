import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const GENERATOR = "scripts/generate-hkd-lipi-registry-phases17-19.mjs";
const OUTPUTS = [
  "data/hkd-lipi-operator-runbook.json",
  "docs/hkd-lipi-registry-operator-runbook.md",
  "release/evidence/hkd-lipi-registry-phase17-operator-runbook.json",
  "data/hkd-lipi-external-review-package.json",
  "docs/hkd-lipi-external-review-package.md",
  "release/evidence/hkd-lipi-registry-phase18-external-review-package.json",
  "data/hkd-lipi-production-go-approval-gate.json",
  "docs/hkd-lipi-production-go-approval-template.md",
  "release/evidence/hkd-lipi-registry-phase19-production-go-gate.json",
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function snapshotHashes() {
  return Object.fromEntries(OUTPUTS.map((path) => [path, sha256(path)]));
}

test("Phase 17 operator runbook is documentation-only and keeps production blocked", () => {
  const runbook = readJson("data/hkd-lipi-operator-runbook.json");
  const evidence = readJson("release/evidence/hkd-lipi-registry-phase17-operator-runbook.json");

  assert.equal(runbook.schema, "hkd-lipi-operator-runbook.v1");
  assert.equal(runbook.reviewState, "CONTROLLED_NO_GO");
  assert.equal(runbook.productionReady, false);
  assert.equal(runbook.governedProductionGo, false);
  assert.equal(runbook.runtimeEnabled, 0);
  assert.equal(runbook.summary.seedRows, 426);
  assert.equal(runbook.summary.runSequenceSteps, 5);
  assert.equal(runbook.summary.operatingChecks, 4);
  assert.equal(runbook.summary.stopConditions, 6);
  assert.equal(runbook.summary.productionGoAllowed, false);
  assert.equal(runbook.summary.runtimeEnablements, 0);
  assert.equal(runbook.runSequence.every((step) => step.command && step.expectedResult), true);
  assert.equal(runbook.operatingChecks.every((check) => check.evidence), true);
  assert.equal(evidence.checks.docsGenerated, true);
  assert.equal(evidence.checks.noRegistryMutation, true);
  assert.equal(evidence.checks.noRuntimeEnablement, true);
  assert.equal(evidence.checks.productionGoAllowedFalse, true);
  assert.ok(existsSync("docs/hkd-lipi-registry-operator-runbook.md"));
});

test("Phase 18 external review package is pending and creates no approval claim", () => {
  const review = readJson("data/hkd-lipi-external-review-package.json");
  const evidence = readJson("release/evidence/hkd-lipi-registry-phase18-external-review-package.json");

  assert.equal(review.schema, "hkd-lipi-external-review-package.v1");
  assert.equal(review.reviewState, "CONTROLLED_NO_GO");
  assert.equal(review.productionReady, false);
  assert.equal(review.governedProductionGo, false);
  assert.equal(review.runtimeEnabled, 0);
  assert.equal(review.reviewPackage.status, "PENDING_EXTERNAL_REVIEW");
  assert.equal(review.reviewPackage.reviewersAssigned, 0);
  assert.equal(review.reviewPackage.reviewerSignoffs, 0);
  assert.equal(review.reviewPackage.reviewComplete, false);
  assert.equal(review.reviewPackage.createsNewClaims, false);
  assert.equal(review.reviewPackage.mutatesRegistry, false);
  assert.equal(review.reviewPackage.runtimeEnablements, 0);
  assert.equal(review.reviewPackage.artifacts.length, 8);
  assert.equal(review.reviewPackage.artifacts.every((artifact) => artifact.path && artifact.sha256), true);
  assert.equal(review.nonClaims.includes("No production GO approval exists."), true);
  assert.equal(evidence.checks.reviewCompleteFalse, true);
  assert.equal(evidence.checks.noNewClaims, true);
  assert.equal(evidence.checks.noRegistryMutation, true);
  assert.equal(evidence.checks.everyReviewArtifactHasHash, true);
});

test("Phase 19 production GO gate requires human approval and zero blockers", () => {
  const gate = readJson("data/hkd-lipi-production-go-approval-gate.json");
  const evidence = readJson("release/evidence/hkd-lipi-registry-phase19-production-go-gate.json");

  assert.equal(gate.schema, "hkd-lipi-production-go-approval-gate.v1");
  assert.equal(gate.reviewState, "CONTROLLED_NO_GO");
  assert.equal(gate.productionReady, false);
  assert.equal(gate.governedProductionGo, false);
  assert.equal(gate.runtimeEnabled, 0);
  assert.equal(gate.summary.productionGoApproved, false);
  assert.equal(gate.summary.productionReady, false);
  assert.equal(gate.summary.humanApprovalPresent, false);
  assert.equal(gate.summary.externalReviewComplete, false);
  assert.equal(gate.summary.activeProductionGoBlockers, 4);
  assert.equal(gate.summary.runtimeEnablements, 0);
  assert.equal(gate.requiredApproval.approvalArtifactPath, "release/evidence/hkd-lipi-production-go-human-approval.json");
  assert.equal(gate.requiredApproval.approved, false);
  assert.equal(gate.gatePolicy.rule, "PRODUCTION_GO_ONLY_AFTER_HUMAN_APPROVAL_AND_ZERO_BLOCKERS");
  assert.equal(gate.gatePolicy.autoApprovalAllowed, false);
  assert.equal(gate.gatePolicy.aiApprovalAllowed, false);
  assert.equal(gate.gatePolicy.runtimeEnablementAllowed, false);
  assert.equal(gate.gatePolicy.productionReadyAllowed, false);
  assert.equal(gate.blockers.every((blocker) => blocker.provenance && blocker.blocksProductionGo === true), true);
  assert.equal(evidence.checks.productionGoApprovedFalse, true);
  assert.equal(evidence.checks.humanApprovalRequired, true);
  assert.equal(evidence.checks.humanApprovalMissingBlocksGo, true);
  assert.equal(evidence.checks.noProductionReadyTrue, true);
  assert.equal(evidence.checks.everyBlockerHasProvenance, true);
});

test("Phase 17-19 generation is reproducible and does not mutate runtime enablement", () => {
  const beforeHashes = snapshotHashes();
  const seedBefore = sha256("data/hkd-lipi-script-registry-seed-426.json");

  execFileSync("node", [GENERATOR], { stdio: "pipe" });

  assert.deepEqual(snapshotHashes(), beforeHashes);
  assert.equal(sha256("data/hkd-lipi-script-registry-seed-426.json"), seedBefore);

  const seed = readJson("data/hkd-lipi-script-registry-seed-426.json");
  assert.equal(seed.records.length, 426);
  assert.equal(seed.records.every((record) => record.hkd_runtime_enabled === false), true);
});
