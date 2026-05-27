import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const evidence = JSON.parse(readFileSync("packages/lipi-runtime/release/evidence/lipi-registry-status.json", "utf8"));
const hardware = JSON.parse(readFileSync("packages/lipi-runtime/release/evidence/lipi-hardware-attestation.json", "utf8"));

test("production readiness remains false", () => {
  assert.equal(evidence.productionReady, false);
});

test("PHKD verdict remains blocked", () => {
  assert.equal(evidence.phkdVerdict, "BLOCKED");
  assert.equal(evidence.finalStatus, "GOVERNED_PRODUCTION_NO_GO");
});

test("hardware evidence does not fake attestation", () => {
  assert.equal(hardware.noFakeClaims, true);
  assert.equal(hardware.status, "BLOCKED");
});
