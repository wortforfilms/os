import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  STATUS_BLOCKED,
  STATUS_CAPTURED,
  STATUS_PARTIAL,
  computeHardwareEvidenceHash,
  createHardwareRootEvidence,
  deriveStatus,
  validateHardwareEvidenceHash,
} from "../scripts/capture-hardware-root-of-trust.mjs";
import { createAttestationChallenge, createSignedPayload } from "../scripts/hardware-attestation/contract.mjs";

const hostPlatform = {
  platform: "test-os",
  arch: "arm64",
  os_type: "TestOS",
  os_release: "1.0.0",
};

test("capture evidence is BLOCKED when no trust source is available", () => {
  const evidence = createHardwareRootEvidence({
    capturedAt: "2026-05-26T00:00:00.000Z",
    hostPlatform,
    commandRunner: () => ({
      command: "missing",
      args: [],
      ok: false,
      exitCode: 1,
      signal: null,
      error: null,
      durationMs: 1,
      stdout: "",
      stderr: "",
    }),
    fileReader: () => "",
    pathExists: () => false,
  });

  assert.equal(evidence.status, STATUS_BLOCKED);
  assert.equal(evidence.production_ready, false);
  assert.equal(evidence.phkd_verdict, "BLOCKED");
  assert.equal(evidence.no_fake_claims, true);
  assert.equal(validateHardwareEvidenceHash(evidence), true);
});

test("capture evidence is PARTIAL when host signals exist but attestation is missing", () => {
  const evidence = createHardwareRootEvidence({
    capturedAt: "2026-05-26T00:00:00.000Z",
    hostPlatform: { ...hostPlatform, platform: "linux" },
    commandRunner: () => ({
      command: "unused",
      args: [],
      ok: true,
      exitCode: 0,
      signal: null,
      error: null,
      durationMs: 1,
      stdout: "cpu",
      stderr: "",
    }),
    fileReader: (path) => (path === "/proc/cpuinfo" ? "processor: test" : ""),
    pathExists: (path) => path === "/dev/tpm0",
  });

  assert.equal(evidence.status, STATUS_PARTIAL);
  assert.equal(evidence.production_ready, false);
  assert.equal(evidence.trust_sources.length > 0, true);
  assert.equal(evidence.blockers.some((blocker) => blocker.id === "HARDWARE_ATTESTATION_QUOTE_MISSING"), true);
});

test("capture evidence becomes CAPTURED only when a provider signature verifies", () => {
  const capturedAt = "2026-05-26T00:00:00.000Z";
  const nonce = "b".repeat(64);
  const trustSeed = "";
  const challenge = createAttestationChallenge({
    hostPlatform,
    capturedAt,
    nonce,
    evidenceBindingSeed: trustSeed,
  });
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
  const signatureB64 = sign("sha256", Buffer.from(createSignedPayload({
    challenge,
    evidenceBindingHash: challenge.challenge_hash,
  }), "utf8"), privateKey).toString("base64");

  const evidence = createHardwareRootEvidence({
    capturedAt,
    nonce,
    hostPlatform,
    env: {
      MAATAA_HSM_PUBLIC_KEY_PEM: "/tmp/hsm-public.pem",
      MAATAA_HSM_SIGNATURE_B64: signatureB64,
      MAATAA_HSM_PROVIDER_ID: "test-hsm",
    },
    commandRunner: () => ({
      command: "missing",
      args: [],
      ok: false,
      exitCode: 1,
      signal: null,
      error: null,
      durationMs: 1,
      stdout: "",
      stderr: "",
    }),
    fileReader: (path) => (path === "/tmp/hsm-public.pem" ? publicKeyPem : ""),
    pathExists: () => false,
  });

  assert.equal(evidence.status, STATUS_CAPTURED);
  assert.equal(evidence.production_ready, true);
  assert.equal(evidence.phkd_verdict, "PASS");
  assert.equal(evidence.trust_sources.some((source) => source.status === "VERIFIED_ATTESTATION"), true);
  assert.equal(validateHardwareEvidenceHash(evidence), true);
});

test("deriveStatus marks clean captured evidence as CAPTURED", () => {
  const status = deriveStatus({
    trustSources: [{ id: "factory-quote" }],
    blockers: [],
  });

  assert.equal(status, STATUS_CAPTURED);
});

test("evidence hash validation detects mutation", () => {
  const payload = {
    schema: "maataa.hardware.root-of-trust.capture.v1",
    status: STATUS_CAPTURED,
    production_ready: true,
    captured_at: "2026-05-26T00:00:00.000Z",
    host_platform: hostPlatform,
    trust_sources: [{ id: "factory-quote" }],
    missing_sources: [],
    phkd_verdict: "PASS",
    blockers: [],
    raw_command_summary: [],
    no_fake_claims: true,
  };
  const evidence = { ...payload, evidence_hash: computeHardwareEvidenceHash(payload) };

  assert.equal(validateHardwareEvidenceHash(evidence), true);
  assert.equal(validateHardwareEvidenceHash({ ...evidence, status: STATUS_PARTIAL }), false);
});
