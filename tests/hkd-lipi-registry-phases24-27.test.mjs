import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const GENERATOR = "scripts/generate-hkd-lipi-registry-phases24-27.mjs";
const OUTPUTS = [
  "release/evidence/hkd-lipi-registry-phase24-cross-browser-validation.json",
  "release/evidence/hkd-lipi-registry-phase25-cross-platform-validation.json",
  "release/evidence/hkd-lipi-registry-phase26-external-review-human-approval.json",
  "release/evidence/hkd-lipi-registry-phase27-production-go-decision.json",
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

test("Phase 24 cross-browser validation records Chrome evidence and blocks missing Firefox/Safari evidence", () => {
  const phase24 = readJson("release/evidence/hkd-lipi-registry-phase24-cross-browser-validation.json");

  assert.equal(phase24.schema, "hkd-lipi-registry-phase24-cross-browser-validation.v1");
  assert.equal(phase24.status, "BLOCKED");
  assert.equal(phase24.phkdVerdict, "CONTROLLED_PREVIEW_NO_GO");
  assert.equal(phase24.productionReady, false);
  assert.equal(phase24.governedProductionGo, false);
  assert.equal(phase24.runtimeEnabledRows, 0);
  assert.equal(phase24.summary.targetBrowsers, 3);
  assert.equal(phase24.summary.verifiedBrowsers, 1);
  assert.equal(phase24.summary.blockedBrowsers, 2);
  assert.equal(phase24.summary.verifiedBaselineRows, 139);
  assert.equal(phase24.summary.browserAtlasImages, 1);
  assert.equal(phase24.checks.chromeBaselineCaptured, true);
  assert.equal(phase24.checks.firefoxCaptured, false);
  assert.equal(phase24.checks.safariCaptured, false);
  assert.equal(phase24.checks.allTargetBrowsersVerified, false);
  assert.equal(phase24.targets.find((target) => target.id === "chrome")?.validationStatus, "VERIFIED");
  assert.equal(phase24.targets.find((target) => target.id === "firefox")?.validationStatus, "BLOCKED");
  assert.equal(phase24.targets.find((target) => target.id === "safari")?.validationStatus, "BLOCKED");
  assert.equal(phase24.blockers.every((blocker) => blocker.provenance), true);
});

test("Phase 25 cross-platform validation verifies local macOS only and blocks Linux/Windows", () => {
  const phase25 = readJson("release/evidence/hkd-lipi-registry-phase25-cross-platform-validation.json");

  assert.equal(phase25.schema, "hkd-lipi-registry-phase25-cross-platform-validation.v1");
  assert.equal(phase25.status, "BLOCKED");
  assert.equal(phase25.productionReady, false);
  assert.equal(phase25.runtimeEnabledRows, 0);
  assert.equal(phase25.summary.targetPlatforms, 3);
  assert.equal(phase25.summary.verifiedPlatforms, 1);
  assert.equal(phase25.summary.blockedPlatforms, 2);
  assert.equal(phase25.platforms.find((target) => target.id === "macos")?.status, "VERIFIED");
  assert.equal(phase25.platforms.find((target) => target.id === "linux")?.status, "BLOCKED");
  assert.equal(phase25.platforms.find((target) => target.id === "windows")?.status, "BLOCKED");
  assert.equal(phase25.checks.macosBaselineVerified, true);
  assert.equal(phase25.checks.allPlatformsVerified, false);
});

test("Phase 26 external review and human approval remain blocked without signed approval", () => {
  const phase26 = readJson("release/evidence/hkd-lipi-registry-phase26-external-review-human-approval.json");

  assert.equal(phase26.schema, "hkd-lipi-registry-phase26-external-review-human-approval.v1");
  assert.equal(phase26.status, "BLOCKED");
  assert.equal(phase26.productionReady, false);
  assert.equal(phase26.runtimeEnabledRows, 0);
  assert.equal(phase26.summary.externalReviewComplete, false);
  assert.equal(phase26.summary.reviewerSignoffs, 0);
  assert.equal(phase26.summary.humanApprovalPresent, false);
  assert.equal(phase26.summary.validSignedHumanApproval, false);
  assert.equal(phase26.approvalArtifact.path, "release/evidence/hkd-lipi-production-go-human-approval.json");
  assert.equal(phase26.approvalArtifact.validSignedApproval, false);
  assert.equal(phase26.checks.noAiApproval, true);
  assert.equal(phase26.checks.noAutoApproval, true);
  assert.equal(phase26.blockers.filter((blocker) => blocker.status === "BLOCKED").length, 4);
});

test("Phase 27 production GO decision is NO_GO and blocks runtime/production promotion", () => {
  const phase27 = readJson("release/evidence/hkd-lipi-registry-phase27-production-go-decision.json");

  assert.equal(phase27.schema, "hkd-lipi-registry-phase27-production-go-decision.v1");
  assert.equal(phase27.status, "PRODUCTION_GO_BLOCKED");
  assert.equal(phase27.decision, "NO_GO");
  assert.equal(phase27.phkdVerdict, "CONTROLLED_PREVIEW_NO_GO");
  assert.equal(phase27.productionReady, false);
  assert.equal(phase27.governedProductionGo, false);
  assert.equal(phase27.runtimeEnabledRows, 0);
  assert.equal(phase27.summary.productionGoApproved, false);
  assert.equal(phase27.summary.productionReady, false);
  assert.equal(phase27.summary.governedProductionGo, false);
  assert.equal(phase27.summary.humanApprovalPresent, false);
  assert.equal(phase27.summary.crossBrowserVerified, false);
  assert.equal(phase27.summary.crossPlatformVerified, false);
  assert.equal(phase27.summary.externalReviewComplete, false);
  assert.equal(phase27.summary.activeProductionGoBlockers > 0, true);
  assert.equal(phase27.summary.runtimeEnabledRows, 0);
  assert.equal(phase27.summary.releaseCandidate, false);
  assert.equal(phase27.decisionPolicy.aiApprovalAllowed, false);
  assert.equal(phase27.decisionPolicy.autoApprovalAllowed, false);
  assert.equal(phase27.decisionPolicy.runtimeEnablementAllowed, false);
});

test("Phase 24-27 generation is reproducible and does not mutate registry rows", () => {
  for (const output of OUTPUTS) {
    assert.equal(existsSync(output), true, `${output} missing`);
  }
  const beforeHashes = snapshotHashes();
  const seedBefore = sha256("data/hkd-lipi-script-registry-seed-426.json");

  execFileSync("node", [GENERATOR], { stdio: "pipe" });

  assert.deepEqual(snapshotHashes(), beforeHashes);
  assert.equal(sha256("data/hkd-lipi-script-registry-seed-426.json"), seedBefore);
  const seed = readJson("data/hkd-lipi-script-registry-seed-426.json");
  assert.equal(seed.records.length, 426);
  assert.equal(seed.records.every((record) => record.hkd_runtime_enabled === false), true);
});
