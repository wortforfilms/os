import test from "node:test";
import assert from "node:assert/strict";
import {
  GOVERNED_GO,
  GOVERNED_NO_GO,
  evaluateGovernedProduction,
  validateHardwareRootEvidence,
} from "../scripts/governed-production-gate.mjs";
import { computeHardwareEvidenceHash } from "../scripts/capture-hardware-root-of-trust.mjs";

function capturedHardwareEvidence(overrides = {}) {
  const payload = {
    schema: "maataa.hardware.root-of-trust.capture.v1",
    status: "CAPTURED",
    production_ready: true,
    captured_at: "2026-05-26T00:00:00.000Z",
    host_platform: {
      platform: "linux",
      arch: "arm64",
      os_type: "Linux",
      os_release: "test",
    },
    trust_sources: [
      {
        id: "factory-tpm-quote",
        type: "tpm-attestation",
        status: "CAPTURED_HASHED",
        summary: "test-only captured attestation digest",
        evidence_sha256: "a".repeat(64),
      },
    ],
    missing_sources: [],
    phkd_verdict: "PASS",
    blockers: [],
    raw_command_summary: [],
    no_fake_claims: true,
    ...overrides,
  };

  return {
    ...payload,
    evidence_hash: computeHardwareEvidenceHash(payload),
  };
}

test("hardware evidence fails closed when missing", () => {
  const result = validateHardwareRootEvidence(null);
  assert.equal(result.ok, false);
  assert.equal(result.failures.includes("hardware evidence artifact is missing"), true);
});

test("hardware evidence rejects PARTIAL or BLOCKED status", () => {
  const partial = validateHardwareRootEvidence(capturedHardwareEvidence({ status: "PARTIAL", production_ready: false, phkd_verdict: "BLOCKED" }));
  assert.equal(partial.ok, false);
  assert.equal(partial.failures.some((failure) => failure.includes("status must be CAPTURED")), true);
});

test("hardware evidence rejects mismatched evidence hash", () => {
  const result = validateHardwareRootEvidence({ ...capturedHardwareEvidence(), evidence_hash: "0".repeat(64) });
  assert.equal(result.ok, false);
  assert.equal(result.failures.includes("hardware root evidence_hash does not match artifact payload"), true);
});

test("hardware evidence rejects fake-claim opt out", () => {
  const result = validateHardwareRootEvidence(capturedHardwareEvidence({ no_fake_claims: false }));
  assert.equal(result.ok, false);
  assert.equal(result.failures.includes("hardware root no_fake_claims must be true"), true);
});

test("hardware evidence rejects empty trust sources", () => {
  const result = validateHardwareRootEvidence(capturedHardwareEvidence({ trust_sources: [] }));
  assert.equal(result.ok, false);
  assert.equal(result.failures.includes("hardware root trust_sources must be non-empty"), true);
});

test("hardware evidence rejects remaining blockers", () => {
  const result = validateHardwareRootEvidence(capturedHardwareEvidence({
    blockers: [{ id: "MISSING_QUOTE", reason: "attestation quote missing" }],
  }));
  assert.equal(result.ok, false);
  assert.equal(result.failures.includes("hardware root blockers must be empty before GO"), true);
});

test("hardware evidence accepts CAPTURED artifact with self-hash and zero blockers", () => {
  const result = validateHardwareRootEvidence(capturedHardwareEvidence());
  assert.equal(result.ok, true);
});

test("governed production refuses GO when completion matrix is still blocked", () => {
  const result = evaluateGovernedProduction({
    completion: { productionReady: false, finalStatus: "CONTROLLED_NO_GO" },
    hardening: { productionReady: true, phkdVerdict: "PASS" },
    hardwareEvidence: capturedHardwareEvidence(),
  });

  assert.equal(result.status, GOVERNED_NO_GO);
  assert.equal(result.productionReady, false);
});

test("governed production unlocks only when every gate is evidence-backed", () => {
  const result = evaluateGovernedProduction({
    completion: { productionReady: true, finalStatus: "GO" },
    hardening: { productionReady: true, phkdVerdict: "PASS" },
    hardwareEvidence: capturedHardwareEvidence(),
  });

  assert.equal(result.status, GOVERNED_GO);
  assert.equal(result.productionReady, true);
});
