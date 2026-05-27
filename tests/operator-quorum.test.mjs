import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createReleaseManifestPayload, verifyOperatorApprovals } from "../scripts/release-authority/contract.mjs";
import {
  createOperatorApproval,
  createOperatorApprovalPayload,
  enrollOperator,
  revokeOperator,
  writeOperatorRegistry,
} from "../scripts/release-authority/operator-registry.mjs";

test("operator registry accepts hardware-backed signer types", () => {
  const root = tempRoot();
  const operator = enroll(root, "brahmini", "Admin", "HSM");

  assert.equal(operator.enrolled.ok, true);
  assert.equal(operator.enrolled.operator.signer_type, "HSM");
  rmSync(root, { recursive: true, force: true });
});

test("single operator approval is blocked by quorum threshold", () => {
  const root = tempRoot();
  const payload = createReleaseManifestPayload({ root, generatedAt: "2026-05-26T00:00:00.000Z" });
  const approval = approve(root, payload, "brahmini", "Admin", "TPM2");
  const result = verifyOperatorApprovals({
    root,
    payload,
    env: {
      MAATAA_RELEASE_APPROVALS_JSON: JSON.stringify([approval.approval]),
      MAATAA_RELEASE_QUORUM: "2",
    },
    now: "2026-05-26T00:00:00.000Z",
  });

  assert.equal(result.status, "BLOCKED");
  assert.equal(result.blockers.includes("approval quorum not met: 1/2"), true);
  rmSync(root, { recursive: true, force: true });
});

test("two valid hardware-backed operator approvals satisfy quorum", () => {
  const root = tempRoot();
  const payload = createReleaseManifestPayload({ root, generatedAt: "2026-05-26T00:00:00.000Z" });
  const first = approve(root, payload, "brahmini", "Admin", "HSM");
  const second = approve(root, payload, "vishNu", "Producer", "SECURE_ENCLAVE");
  const result = verifyOperatorApprovals({
    root,
    payload,
    env: {
      MAATAA_RELEASE_APPROVALS_JSON: JSON.stringify([first.approval, second.approval]),
      MAATAA_RELEASE_QUORUM: "2",
    },
    now: "2026-05-26T00:00:00.000Z",
  });

  assert.equal(result.status, "VERIFIED");
  assert.equal(result.verified_count, 2);
  rmSync(root, { recursive: true, force: true });
});

test("revoked operator cannot satisfy quorum", () => {
  const root = tempRoot();
  const payload = createReleaseManifestPayload({ root, generatedAt: "2026-05-26T00:00:00.000Z" });
  const approval = approve(root, payload, "brahmini", "Admin", "HSM");
  const revoked = revokeOperator({ root, operatorId: "brahmini", registry: approval.registry });
  writeOperatorRegistry({ root, registry: revoked.registry });
  const result = verifyOperatorApprovals({
    root,
    payload,
    env: {
      MAATAA_RELEASE_APPROVALS_JSON: JSON.stringify([approval.approval]),
      MAATAA_RELEASE_QUORUM: "1",
    },
    now: "2026-05-26T00:00:00.000Z",
  });

  assert.equal(result.status, "BLOCKED");
  assert.equal(result.blockers.some((blocker) => blocker.includes("operator is revoked")), true);
  rmSync(root, { recursive: true, force: true });
});

test("expired approval cannot satisfy quorum", () => {
  const root = tempRoot();
  const payload = createReleaseManifestPayload({ root, generatedAt: "2026-05-26T00:00:00.000Z" });
  const approval = approve(root, payload, "brahmini", "Admin", "HSM", { expiresAt: "2026-05-26T00:01:00.000Z" });
  const result = verifyOperatorApprovals({
    root,
    payload,
    env: {
      MAATAA_RELEASE_APPROVALS_JSON: JSON.stringify([approval.approval]),
      MAATAA_RELEASE_QUORUM: "1",
    },
    now: "2026-05-26T00:02:00.000Z",
  });

  assert.equal(result.status, "BLOCKED");
  assert.equal(result.blockers.some((blocker) => blocker.includes("expired")), true);
  rmSync(root, { recursive: true, force: true });
});

function approve(root, payload, operatorId, role, signerType, options = {}) {
  const operator = enroll(root, operatorId, role, signerType);
  const approvedAt = options.approvedAt ?? "2026-05-26T00:00:00.000Z";
  const approvalPayload = createOperatorApprovalPayload({
    releaseManifestHash: payload.manifest_hash,
    operatorId,
    role,
    nonce: `${operatorId}-nonce`,
    approvedAt,
    expiresAt: options.expiresAt ?? "2026-05-26T00:15:00.000Z",
  });
  const approval = createOperatorApproval({
    payload: approvalPayload,
    signatureB64: sign("sha256", Buffer.from(JSON.stringify(approvalPayload), "utf8"), operator.privateKey).toString("base64"),
  });
  return { approval, registry: operator.enrolled.registry };
}

function enroll(root, operatorId, role, signerType) {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
  const enrolled = enrollOperator({
    root,
    operatorId,
    role,
    signerType,
    publicKeyPem,
  });
  writeOperatorRegistry({ root, registry: enrolled.registry });
  return { enrolled, publicKeyPem, privateKey };
}

function tempRoot() {
  const root = join(tmpdir(), `maataa-operator-quorum-${process.pid}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ version: "0.1.0-test" }), "utf8");
  return root;
}
