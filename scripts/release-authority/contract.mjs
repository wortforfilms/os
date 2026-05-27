import { createHash, verify as cryptoVerify } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  readOperatorApprovals,
  readOperatorRegistry,
  scrubRegistry,
  verifyOperatorApprovalAgainstRegistry,
} from "./operator-registry.mjs";

export const RELEASE_AUTHORITY_SCHEMA = "maataa.release.authority.v1";
export const SIGNED_RELEASE_MANIFEST_SCHEMA = "maataa.release.signed-manifest.v1";
export const RELEASE_AUTHORITY_VERIFIED = "VERIFIED";
export const RELEASE_AUTHORITY_BLOCKED = "BLOCKED";
export const RELEASE_CANDIDATE = "GOVERNED_RELEASE_CANDIDATE";

export function createReleaseManifestPayload({
  root = process.cwd(),
  generatedAt = new Date().toISOString(),
  version = readPackageVersion(root),
  commit = "unknown",
} = {}) {
  const inputs = {
    completion_matrix: sha256FileOrNull(join(root, "COMPLETION_STATUS_MATRIX.json")),
    hardening_matrix: sha256FileOrNull(join(root, "release/reports/PRODUCTION_HARDENING_MATRIX.json")),
    hardware_root_of_trust: sha256FileOrNull(join(root, "release/evidence/hardware-root-of-trust.json")),
    governed_gate: sha256FileOrNull(join(root, "release/evidence/governed-production-gate.json")),
  };
  const payload = {
    schema: "maataa.release.manifest.payload.v1",
    version,
    commit,
    generated_at: generatedAt,
    inputs,
    no_unsigned_production_release: true,
    no_fake_signatures: true,
  };

  return {
    ...payload,
    manifest_hash: sha256Json(payload),
  };
}

export function verifyReleaseSigner({ payload, env = process.env, fileReader = readTextFile } = {}) {
  const signerResults = [
    verifyConfiguredSigner({
      providerId: env.MAATAA_RELEASE_TPM2_PROVIDER_ID || "release-tpm2-signer",
      providerType: "tpm2-release-signer",
      publicKeyPath: env.MAATAA_RELEASE_TPM2_PUBLIC_KEY_PEM,
      signatureB64: env.MAATAA_RELEASE_TPM2_SIGNATURE_B64,
      certificatePath: env.MAATAA_RELEASE_TPM2_CERTIFICATE_PEM,
      payload,
      fileReader,
    }),
    verifyConfiguredSigner({
      providerId: env.MAATAA_RELEASE_HSM_PROVIDER_ID || "release-hsm-signer",
      providerType: "external-hsm-release-signer",
      publicKeyPath: env.MAATAA_RELEASE_HSM_PUBLIC_KEY_PEM,
      signatureB64: env.MAATAA_RELEASE_HSM_SIGNATURE_B64,
      certificatePath: env.MAATAA_RELEASE_HSM_CERTIFICATE_PEM,
      payload,
      fileReader,
    }),
  ];

  return {
    verified: signerResults.filter((result) => result.status === RELEASE_AUTHORITY_VERIFIED),
    blocked: signerResults.filter((result) => result.status !== RELEASE_AUTHORITY_VERIFIED),
    signer_results: signerResults,
  };
}

export function verifyOperatorApprovals({
  root = process.cwd(),
  payload,
  env = process.env,
  fileReader = readTextFile,
  quorum = Number.parseInt(env.MAATAA_RELEASE_QUORUM || "2", 10),
  now = new Date().toISOString(),
} = {}) {
  const source = env.MAATAA_RELEASE_APPROVALS_JSON || null;
  let approvals;
  try {
    approvals = readOperatorApprovals({ root, fileReader, source });
  } catch {
    return {
      status: RELEASE_AUTHORITY_BLOCKED,
      quorum,
      verified_count: 0,
      approvals: [],
      blockers: ["operator approval JSON is malformed"],
    };
  }

  const registry = readOperatorRegistry({ root, fileReader });
  const verifiedApprovals = [];
  const blockers = [];
  const seenOperators = new Set();

  for (const approval of approvals) {
    const result = verifyOperatorApprovalAgainstRegistry({
      approval,
      releaseManifestHash: payload.manifest_hash,
      registry,
      now,
    });
    if (result.status === RELEASE_AUTHORITY_VERIFIED) {
      if (seenOperators.has(result.operator_id)) {
        blockers.push(`duplicate operator approval: ${result.operator_id}`);
      } else {
        seenOperators.add(result.operator_id);
        verifiedApprovals.push(result);
      }
    } else {
      blockers.push(`${approval.operator_id ?? "unknown"}: ${result.reason}`);
    }
  }

  if (verifiedApprovals.length < quorum) {
    blockers.push(`approval quorum not met: ${verifiedApprovals.length}/${quorum}`);
  }

  return {
    status: blockers.length === 0 ? RELEASE_AUTHORITY_VERIFIED : RELEASE_AUTHORITY_BLOCKED,
    quorum,
    verified_count: verifiedApprovals.length,
    approvals: verifiedApprovals,
    registry: scrubRegistry(registry),
    blockers,
  };
}

export function verifySignedReleaseManifest(manifest) {
  const failures = [];

  if (!manifest || typeof manifest !== "object") {
    return { ok: false, failures: ["signed release manifest is missing"] };
  }
  if (manifest.schema !== SIGNED_RELEASE_MANIFEST_SCHEMA) {
    failures.push("signed release manifest schema mismatch");
  }
  if (!manifest.payload || manifest.payload.manifest_hash !== sha256Json(stripManifestHash(manifest.payload))) {
    failures.push("release manifest payload hash mismatch");
  }
  if (!manifest.signer || manifest.signer.status !== RELEASE_AUTHORITY_VERIFIED) {
    failures.push("release manifest signer is not verified");
  }
  if (!manifest.operator_approval || manifest.operator_approval.status !== RELEASE_AUTHORITY_VERIFIED) {
    failures.push("operator approval quorum is not verified");
  }
  if (manifest.status !== RELEASE_AUTHORITY_VERIFIED) {
    failures.push("signed release manifest status must be VERIFIED");
  }
  if (manifest.no_fake_signatures !== true) {
    failures.push("signed release manifest no_fake_signatures must be true");
  }

  return { ok: failures.length === 0, failures };
}

export function writeReleaseAuthorityArtifacts({ root = process.cwd(), artifacts }) {
  const base = join(root, "release/release-authority");
  const evidenceBase = join(root, "release/evidence");
  mkdirSync(base, { recursive: true });
  mkdirSync(evidenceBase, { recursive: true });
  writeJson(join(base, "release-authority.json"), artifacts.authority);
  writeJson(join(base, "signed-release-manifest.json"), artifacts.signedManifest);
  writeJson(join(base, "release-lineage-history.json"), artifacts.lineage);
  writeJson(join(base, "operator-approval-log.json"), artifacts.operatorApprovalLog);
  writeJson(join(base, "release-certificate-registry.json"), artifacts.certificateRegistry);
  writeJson(join(evidenceBase, "release-authority.json"), artifacts.authority);
  writeFileSync(join(evidenceBase, "release-authority.md"), renderReleaseAuthorityMarkdown(artifacts.authority), "utf8");
}

export function renderReleaseAuthorityMarkdown(authority) {
  return [
    "# Release Authority",
    "",
    `Generated: ${authority.generated_at}`,
    `Status: ${authority.status}`,
    `Release candidate: ${authority.release_candidate}`,
    `Verified signers: ${authority.signer?.verified?.length ?? 0}`,
    `Approval quorum: ${authority.operator_approval?.verified_count ?? 0}/${authority.operator_approval?.quorum ?? 0}`,
    "",
    "## Blockers",
    "",
    ...(authority.blockers.length === 0 ? ["- none"] : authority.blockers.map((blocker) => `- ${blocker}`)),
    "",
  ].join("\n");
}

function verifyConfiguredSigner({ providerId, providerType, publicKeyPath, signatureB64, certificatePath, payload, fileReader }) {
  if (!publicKeyPath || !signatureB64) {
    return {
      provider_id: providerId,
      provider_type: providerType,
      status: RELEASE_AUTHORITY_BLOCKED,
      reason: `${providerType} public key and signature environment variables are not configured`,
    };
  }

  const publicKeyPem = fileReader(publicKeyPath);
  const certificatePem = certificatePath ? fileReader(certificatePath) : null;
  if (!publicKeyPem) {
    return {
      provider_id: providerId,
      provider_type: providerType,
      status: RELEASE_AUTHORITY_BLOCKED,
      reason: `${providerType} public key is unreadable`,
    };
  }

  const payloadBytes = Buffer.from(JSON.stringify(payload), "utf8");
  let signatureOk = false;
  try {
    signatureOk = cryptoVerify("sha256", payloadBytes, publicKeyPem, Buffer.from(signatureB64, "base64"));
  } catch {
    signatureOk = false;
  }

  if (!signatureOk) {
    return {
      provider_id: providerId,
      provider_type: providerType,
      status: RELEASE_AUTHORITY_BLOCKED,
      reason: `${providerType} signature verification failed`,
      public_key_sha256: sha256Text(publicKeyPem),
      certificate_sha256: certificatePem ? sha256Text(certificatePem) : null,
    };
  }

  return {
    provider_id: providerId,
    provider_type: providerType,
    status: RELEASE_AUTHORITY_VERIFIED,
    reason: `${providerType} signature verified`,
    public_key_sha256: sha256Text(publicKeyPem),
    certificate_sha256: certificatePem ? sha256Text(certificatePem) : null,
    signature_sha256: sha256Text(signatureB64),
  };
}

function stripManifestHash(payload) {
  const { manifest_hash: _manifestHash, ...withoutHash } = payload;
  return withoutHash;
}

function readPackageVersion(root) {
  try {
    return JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function readTextFile(path) {
  try {
    if (!path || !existsSync(path)) {
      return "";
    }
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function sha256FileOrNull(path) {
  if (!existsSync(path)) {
    return null;
  }
  return createHash("sha256").update(readFileSync(path)).digest("hex");
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

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
