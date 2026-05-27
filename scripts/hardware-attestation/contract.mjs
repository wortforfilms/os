import { createHash, randomBytes, verify as cryptoVerify } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const ATTESTATION_CONTRACT_SCHEMA = "maataa.hardware.attestation.contract.v1";
export const ATTESTATION_RECORD_SCHEMA = "maataa.hardware.attestation.record.v1";
export const ATTESTATION_VERIFIED = "VERIFIED";
export const ATTESTATION_UNAVAILABLE = "UNAVAILABLE";
export const ATTESTATION_FAILED = "FAILED";

export function createAttestationChallenge({
  hostPlatform,
  capturedAt,
  nonce = randomBytes(32).toString("hex"),
  evidenceBindingSeed = "",
} = {}) {
  const challenge = {
    schema: ATTESTATION_CONTRACT_SCHEMA,
    nonce,
    issued_at: capturedAt,
    host_platform: hostPlatform,
    evidence_binding_seed: sha256Text(evidenceBindingSeed),
    replay_window: "single-use",
  };

  return {
    ...challenge,
    challenge_hash: sha256Json(challenge),
  };
}

export function createSignedAttestationRecord({
  providerId,
  providerType,
  challenge,
  evidenceBindingHash,
  publicKeyPem,
  certificatePem = null,
  signatureB64,
  quoteHash = null,
  rawSummary = {},
}) {
  return {
    schema: ATTESTATION_RECORD_SCHEMA,
    provider_id: providerId,
    provider_type: providerType,
    status: signatureB64 ? ATTESTATION_VERIFIED : ATTESTATION_UNAVAILABLE,
    nonce: challenge.nonce,
    challenge_hash: challenge.challenge_hash,
    evidence_binding_hash: evidenceBindingHash,
    public_key_sha256: publicKeyPem ? sha256Text(publicKeyPem) : null,
    certificate_sha256: certificatePem ? sha256Text(certificatePem) : null,
    signature_b64: signatureB64,
    quote_sha256: quoteHash,
    signed_payload: createSignedPayload({ challenge, evidenceBindingHash }),
    raw_summary: rawSummary,
  };
}

export function createSignedPayload({ challenge, evidenceBindingHash }) {
  return JSON.stringify({
    schema: "maataa.hardware.attestation.signed-payload.v1",
    nonce: challenge.nonce,
    challenge_hash: challenge.challenge_hash,
    evidence_binding_hash: evidenceBindingHash,
  });
}

export function verifyAttestationRecord(record, challenge, { replayCachePath = null } = {}) {
  const failures = [];

  if (!record || typeof record !== "object") {
    return { ok: false, failures: ["attestation record is missing"] };
  }

  if (record.schema !== ATTESTATION_RECORD_SCHEMA) {
    failures.push("attestation record schema mismatch");
  }
  if (record.status !== ATTESTATION_VERIFIED) {
    failures.push(`attestation record status must be ${ATTESTATION_VERIFIED}`);
  }
  if (record.nonce !== challenge.nonce) {
    failures.push("attestation nonce mismatch");
  }
  if (record.challenge_hash !== challenge.challenge_hash) {
    failures.push("attestation challenge hash mismatch");
  }
  if (!record.evidence_binding_hash || typeof record.evidence_binding_hash !== "string") {
    failures.push("attestation evidence binding hash is required");
  }
  if (!record.signature_b64 || typeof record.signature_b64 !== "string") {
    failures.push("attestation signature is required");
  }
  if (!record.public_key_pem || typeof record.public_key_pem !== "string") {
    failures.push("attestation public key is required for local verification");
  }

  if (record.public_key_pem && record.signature_b64 && record.signed_payload) {
    try {
      const ok = cryptoVerify(
        "sha256",
        Buffer.from(record.signed_payload, "utf8"),
        record.public_key_pem,
        Buffer.from(record.signature_b64, "base64"),
      );
      if (!ok) {
        failures.push("attestation signature verification failed");
      }
    } catch (error) {
      failures.push(`attestation signature verification error: ${error.message}`);
    }
  }

  if (record.signed_payload !== createSignedPayload({ challenge, evidenceBindingHash: record.evidence_binding_hash })) {
    failures.push("attestation signed payload is not bound to nonce and evidence hash");
  }

  if (replayCachePath && failures.length === 0) {
    const replayResult = assertNonceNotReplayed(replayCachePath, record);
    if (!replayResult.ok) {
      failures.push(...replayResult.failures);
    }
  }

  return {
    ok: failures.length === 0,
    failures,
  };
}

export function assertNonceNotReplayed(replayCachePath, record) {
  const cache = readReplayCache(replayCachePath);
  const key = `${record.provider_id}:${record.nonce}`;
  if (cache.used_nonces.includes(key)) {
    return { ok: false, failures: ["attestation nonce was already used"] };
  }
  cache.used_nonces.push(key);
  mkdirSync(dirname(replayCachePath), { recursive: true });
  writeFileSync(replayCachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  return { ok: true, failures: [] };
}

export function readReplayCache(path) {
  if (!path || !existsSync(path)) {
    return { schema: "maataa.hardware.attestation.replay-cache.v1", used_nonces: [] };
  }
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (Array.isArray(parsed.used_nonces)) {
      return parsed;
    }
  } catch {
    return { schema: "maataa.hardware.attestation.replay-cache.v1", used_nonces: [] };
  }
  return { schema: "maataa.hardware.attestation.replay-cache.v1", used_nonces: [] };
}

export function sha256Json(value) {
  return sha256Text(JSON.stringify(canonicalize(value)));
}

export function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}
