import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  createAttestationChallenge,
  createSignedPayload,
  verifyAttestationRecord,
} from "../scripts/hardware-attestation/contract.mjs";
import { runAttestationAdapters, summarizeAttestationResults } from "../scripts/hardware-attestation/providers.mjs";

const hostPlatform = {
  platform: "linux",
  arch: "x64",
  os_type: "Linux",
  os_release: "test",
};

test("remote verifier contract accepts nonce-bound HSM signature", () => {
  const challenge = createAttestationChallenge({
    hostPlatform,
    capturedAt: "2026-05-26T00:00:00.000Z",
    nonce: "a".repeat(64),
    evidenceBindingSeed: "seed",
  });
  const evidenceBindingHash = challenge.challenge_hash;
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
  const signedPayload = createSignedPayload({ challenge, evidenceBindingHash });
  const signatureB64 = sign("sha256", Buffer.from(signedPayload, "utf8"), privateKey).toString("base64");

  const [,, hsmResult] = runAttestationAdapters({
    challenge,
    hostPlatform,
    evidenceBindingHash,
    env: {
      MAATAA_HSM_PUBLIC_KEY_PEM: "/keys/hsm.pem",
      MAATAA_HSM_SIGNATURE_B64: signatureB64,
    },
    commandRunner: () => ({ ok: false, stdout: "", stderr: "", status: 1 }),
    pathExists: () => false,
    fileReader: (path) => (path === "/keys/hsm.pem" ? publicKeyPem : ""),
  });

  assert.equal(hsmResult.status, "VERIFIED");
  assert.equal(hsmResult.verification.ok, true);
});

test("remote verifier rejects replayed nonce", async () => {
  const challenge = createAttestationChallenge({
    hostPlatform,
    capturedAt: "2026-05-26T00:00:00.000Z",
    nonce: "c".repeat(64),
    evidenceBindingSeed: "seed",
  });
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
  const signedPayload = createSignedPayload({ challenge, evidenceBindingHash: challenge.challenge_hash });
  const record = {
    schema: "maataa.hardware.attestation.record.v1",
    provider_id: "replay-test",
    provider_type: "external-hsm",
    status: "VERIFIED",
    nonce: challenge.nonce,
    challenge_hash: challenge.challenge_hash,
    evidence_binding_hash: challenge.challenge_hash,
    public_key_pem: publicKeyPem,
    signature_b64: sign("sha256", Buffer.from(signedPayload, "utf8"), privateKey).toString("base64"),
    signed_payload: signedPayload,
  };

  const replayCache = {
    schema: "maataa.hardware.attestation.replay-cache.v1",
    used_nonces: [`${record.provider_id}:${record.nonce}`],
  };
  const fsPath = `/tmp/maataa-attestation-replay-${process.pid}.json`;
  await import("node:fs").then(({ writeFileSync, rmSync }) => {
    writeFileSync(fsPath, `${JSON.stringify(replayCache)}\n`, "utf8");
    const result = verifyAttestationRecord(record, challenge, { replayCachePath: fsPath });
    rmSync(fsPath, { force: true });
    assert.equal(result.ok, false);
    assert.equal(result.failures.includes("attestation nonce was already used"), true);
  });
});

test("provider summary reports unavailable adapters without promoting capture", () => {
  const challenge = createAttestationChallenge({
    hostPlatform: { ...hostPlatform, platform: "darwin" },
    capturedAt: "2026-05-26T00:00:00.000Z",
    nonce: "d".repeat(64),
  });
  const results = runAttestationAdapters({
    challenge,
    hostPlatform: { ...hostPlatform, platform: "darwin" },
    env: {},
    commandRunner: () => ({ ok: false, stdout: "", stderr: "", status: 1 }),
    pathExists: () => false,
    fileReader: () => "",
  });
  const summary = summarizeAttestationResults(results);

  assert.equal(summary.verified.length, 0);
  assert.equal(summary.unavailable.length > 0, true);
});
