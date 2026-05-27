import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const matrix = JSON.parse(readFileSync("data/language-interface-matrix.json", "utf8"));
const readiness = JSON.parse(readFileSync("release/evidence/launch-readiness-matrix.json", "utf8"));
const allowedBadges = new Set(["READY", "PREVIEW", "BLOCKED", "OFFLINE", "VERIFYING", "DEGRADED"]);
const requiredFrames = [
  "home",
  "language-select",
  "aam-jantaa-dashboard",
  "feature-entry-cards",
  "runtime-health",
  "evidence-blocked-reason",
  "rollback-offline-fallback",
];
const requiredLanguages = ["hindi", "haryanvi", "punjabi"];

test("all required Aam Jantaa frames exist", () => {
  const frameIds = new Set(matrix.frames.map((frame) => frame.id));
  for (const frame of requiredFrames) {
    assert.equal(frameIds.has(frame), true, `${frame} is missing`);
  }
});

test("Hindi, Haryanvi, and Punjabi modes exist", () => {
  const languageIds = new Set(matrix.languages.map((language) => language.id));
  for (const language of requiredLanguages) {
    assert.equal(languageIds.has(language), true, `${language} is missing`);
  }
});

test("every feature has an honest badge", () => {
  for (const feature of matrix.features) {
    assert.equal(allowedBadges.has(feature.statusBadge), true, `${feature.id} has invalid badge ${feature.statusBadge}`);
  }
});

test("blocked features include a reason", () => {
  for (const feature of matrix.features.filter((entry) => entry.statusBadge === "BLOCKED")) {
    assert.equal(typeof feature.blockedReason, "string", `${feature.id} needs blockedReason`);
    assert.equal(feature.blockedReason.length > 0, true, `${feature.id} blockedReason is empty`);
  }
});

test("productionReady remains false", () => {
  assert.equal(matrix.productionReady, false);
  assert.equal(readiness.productionReady, false);
});

test("finalStatus remains GOVERNED_PRODUCTION_NO_GO without real evidence", () => {
  assert.equal(matrix.finalStatus, "GOVERNED_PRODUCTION_NO_GO");
  assert.equal(readiness.finalStatus, "GOVERNED_PRODUCTION_NO_GO");
  assert.notEqual(readiness.finalStatus, "GOVERNED_PRODUCTION_GO");
});

test("no fake GO state is allowed", () => {
  assert.equal(readiness.noFakeGoState, true);
  assert.equal(readiness.noHardwareProofInvented, true);
  assert.equal(readiness.noOperatorSignatureInvented, true);
  assert.equal(readiness.noReleaseAuthorityInvented, true);
  assert.equal(readiness.phkdVerdict, "BLOCKED");
});

test("offline-capable modules are explicitly marked", () => {
  for (const feature of matrix.features) {
    assert.equal(typeof feature.offlineAvailability, "boolean", `${feature.id} must declare offlineAvailability`);
  }
  const offlineCapable = matrix.features.filter((feature) => feature.offlineAvailability === true);
  assert.equal(offlineCapable.length >= 4, true);
});

test("required governance fields are present", () => {
  for (const field of [
    "phkdVerdict",
    "productionReady",
    "finalStatus",
    "activeBlockers",
    "hardwareAttestationStatus",
    "releaseSignerStatus",
    "operatorQuorumStatus",
    "rollbackDrillStatus",
    "languageSupportStatus",
    "contentReadinessStatus",
  ]) {
    assert.equal(Object.hasOwn(readiness, field), true, `${field} is missing`);
  }
});
