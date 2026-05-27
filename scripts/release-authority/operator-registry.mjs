import { createHash, randomBytes, verify as cryptoVerify } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const OPERATOR_REGISTRY_SCHEMA = "maataa.release.operator-registry.v1";
export const OPERATOR_APPROVAL_SCHEMA = "maataa.release.operator-approval.v1";
export const HARDWARE_SIGNER_TYPES = new Set(["TPM2", "HSM", "SECURE_ENCLAVE"]);
export const ALL_SIGNER_TYPES = new Set(["TPM2", "HSM", "SECURE_ENCLAVE", "BLOCKED"]);

export function operatorRegistryPath(root = process.cwd()) {
  return join(root, "release/release-authority/operator-registry.json");
}

export function operatorApprovalsPath(root = process.cwd()) {
  return join(root, "release/release-authority/operator-approvals.json");
}

export function readOperatorRegistry({ root = process.cwd(), fileReader = readTextFile } = {}) {
  const raw = fileReader(operatorRegistryPath(root));
  if (!raw) {
    return emptyRegistry();
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed.schema === OPERATOR_REGISTRY_SCHEMA && Array.isArray(parsed.operators) && Array.isArray(parsed.revoked_operators)) {
      return parsed;
    }
  } catch {
    return emptyRegistry();
  }
  return emptyRegistry();
}

export function writeOperatorRegistry({ root = process.cwd(), registry }) {
  const path = operatorRegistryPath(root);
  mkdirSync(dirname(path), { recursive: true });
  writeJson(path, registry);
  return path;
}

export function enrollOperator({
  root = process.cwd(),
  operatorId,
  role,
  signerType,
  publicKeyPem,
  certificatePem = null,
  enrolledAt = new Date().toISOString(),
  registry = readOperatorRegistry({ root }),
} = {}) {
  const failures = [];
  if (!operatorId || typeof operatorId !== "string") failures.push("operator_id is required");
  if (!role || typeof role !== "string") failures.push("role is required");
  if (!ALL_SIGNER_TYPES.has(signerType)) failures.push("signer_type must be TPM2, HSM, SECURE_ENCLAVE, or BLOCKED");
  if (!publicKeyPem || typeof publicKeyPem !== "string") failures.push("public key PEM is required");

  if (failures.length > 0) {
    return { ok: false, failures, registry };
  }

  const operator = {
    operator_id: operatorId,
    role,
    signer_type: signerType,
    status: signerType === "BLOCKED" ? "BLOCKED" : "ENROLLED",
    public_key_sha256: sha256Text(publicKeyPem),
    certificate_sha256: certificatePem ? sha256Text(certificatePem) : null,
    public_key_pem: publicKeyPem,
    enrolled_at: enrolledAt,
  };
  const operators = registry.operators.filter((entry) => entry.operator_id !== operatorId);
  operators.push(operator);
  const nextRegistry = {
    ...registry,
    updated_at: enrolledAt,
    operators: operators.sort((a, b) => a.operator_id.localeCompare(b.operator_id)),
  };

  return { ok: true, failures: [], operator: scrubOperator(operator), registry: nextRegistry };
}

export function revokeOperator({
  root = process.cwd(),
  operatorId,
  reason = "operator revoked",
  revokedAt = new Date().toISOString(),
  registry = readOperatorRegistry({ root }),
} = {}) {
  if (!operatorId) {
    return { ok: false, failures: ["operator_id is required"], registry };
  }
  const revoked = registry.revoked_operators.filter((entry) => entry.operator_id !== operatorId);
  revoked.push({ operator_id: operatorId, reason, revoked_at: revokedAt });
  return {
    ok: true,
    registry: {
      ...registry,
      updated_at: revokedAt,
      revoked_operators: revoked.sort((a, b) => a.operator_id.localeCompare(b.operator_id)),
    },
  };
}

export function createOperatorApprovalPayload({
  releaseManifestHash,
  operatorId,
  role,
  nonce = randomBytes(32).toString("hex"),
  approvedAt = new Date().toISOString(),
  expiresAt,
} = {}) {
  const expiry = expiresAt ?? new Date(Date.parse(approvedAt) + 15 * 60 * 1000).toISOString();
  return {
    schema: "maataa.release.operator-approval.payload.v1",
    release_manifest_hash: releaseManifestHash,
    operator_id: operatorId,
    role,
    nonce,
    approved_at: approvedAt,
    expires_at: expiry,
  };
}

export function createOperatorApproval({
  payload,
  signatureB64,
} = {}) {
  return {
    ...payload,
    schema: OPERATOR_APPROVAL_SCHEMA,
    signature_b64: signatureB64,
    payload_hash: sha256Json(payload),
  };
}

export function verifyOperatorApprovalAgainstRegistry({
  approval,
  releaseManifestHash,
  registry,
  now = new Date().toISOString(),
} = {}) {
  if (!approval || typeof approval !== "object") {
    return blocked("unknown", "operator approval is missing");
  }
  if (approval.schema !== OPERATOR_APPROVAL_SCHEMA) {
    return blocked(approval.operator_id, "operator approval schema mismatch");
  }
  if (approval.release_manifest_hash !== releaseManifestHash) {
    return blocked(approval.operator_id, "operator approval release hash mismatch");
  }
  if (!approval.nonce || typeof approval.nonce !== "string") {
    return blocked(approval.operator_id, "operator approval nonce is required");
  }
  if (!approval.expires_at || Date.parse(approval.expires_at) <= Date.parse(now)) {
    return blocked(approval.operator_id, "operator approval is expired");
  }

  const operator = registry.operators.find((entry) => entry.operator_id === approval.operator_id);
  if (!operator) {
    return blocked(approval.operator_id, "operator is not enrolled");
  }
  if (registry.revoked_operators.some((entry) => entry.operator_id === approval.operator_id)) {
    return blocked(approval.operator_id, "operator is revoked");
  }
  if (!HARDWARE_SIGNER_TYPES.has(operator.signer_type)) {
    return blocked(approval.operator_id, `operator signer type is ${operator.signer_type}; hardware-backed signer is required`);
  }

  const payload = createOperatorApprovalPayload({
    releaseManifestHash: approval.release_manifest_hash,
    operatorId: approval.operator_id,
    role: approval.role,
    nonce: approval.nonce,
    approvedAt: approval.approved_at,
    expiresAt: approval.expires_at,
  });
  if (approval.payload_hash !== sha256Json(payload)) {
    return blocked(approval.operator_id, "operator approval payload hash mismatch");
  }

  let signatureOk = false;
  try {
    signatureOk = cryptoVerify("sha256", Buffer.from(JSON.stringify(payload), "utf8"), operator.public_key_pem, Buffer.from(approval.signature_b64, "base64"));
  } catch {
    signatureOk = false;
  }
  if (!signatureOk) {
    return blocked(approval.operator_id, "operator approval signature verification failed");
  }

  return {
    status: "VERIFIED",
    operator_id: approval.operator_id,
    role: approval.role,
    signer_type: operator.signer_type,
    approved_at: approval.approved_at,
    expires_at: approval.expires_at,
    nonce_sha256: sha256Text(approval.nonce),
    public_key_sha256: operator.public_key_sha256,
    certificate_sha256: operator.certificate_sha256,
    signature_sha256: sha256Text(approval.signature_b64),
  };
}

export function readOperatorApprovals({ root = process.cwd(), fileReader = readTextFile, source = null } = {}) {
  const raw = source ? (source.trim().startsWith("[") ? source : fileReader(source)) : fileReader(operatorApprovalsPath(root));
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

export function appendOperatorApproval({ root = process.cwd(), approval }) {
  const existing = readOperatorApprovals({ root });
  const filtered = existing.filter((entry) => !(entry.operator_id === approval.operator_id && entry.release_manifest_hash === approval.release_manifest_hash));
  filtered.push(approval);
  const path = operatorApprovalsPath(root);
  mkdirSync(dirname(path), { recursive: true });
  writeJson(path, filtered);
  return { path, approvals: filtered };
}

export function scrubRegistry(registry) {
  return {
    ...registry,
    operators: registry.operators.map(scrubOperator),
  };
}

export function scrubOperator(operator) {
  const { public_key_pem: _publicKeyPem, ...safe } = operator;
  return safe;
}

function emptyRegistry() {
  return {
    schema: OPERATOR_REGISTRY_SCHEMA,
    updated_at: null,
    operators: [],
    revoked_operators: [],
  };
}

function blocked(operatorId, reason) {
  return { status: "BLOCKED", operator_id: operatorId, reason };
}

function readTextFile(path) {
  try {
    if (!path || !existsSync(path)) return "";
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

export function sha256Json(value) {
  return sha256Text(JSON.stringify(canonicalize(value)));
}

export function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
