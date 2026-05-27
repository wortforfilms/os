import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createReleaseManifestPayload,
  verifyOperatorApprovals,
  verifyReleaseSigner,
} from "../scripts/release-authority/contract.mjs";
import {
  createOperatorApproval,
  createOperatorApprovalPayload,
  enrollOperator,
  revokeOperator,
  writeOperatorRegistry,
} from "../scripts/release-authority/operator-registry.mjs";
import { createReleaseAuthorityArtifacts } from "../scripts/release-authority/sign-release.mjs";

function keyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  return {
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }),
    privateKey,
  };
}

test("release signer blocks without hardware-backed signature material", () => {
  const payload = createReleaseManifestPayload({ root: process.cwd(), generatedAt: "2026-05-26T00:00:00.000Z" });
  const result = verifyReleaseSigner({
    payload,
    env: {},
    fileReader: () => "",
  });

  assert.equal(result.verified.length, 0);
  assert.equal(result.blocked.length, 2);
});

test("external HSM release signer verifies manifest payload signature", () => {
  const payload = createReleaseManifestPayload({ root: process.cwd(), generatedAt: "2026-05-26T00:00:00.000Z" });
  const { publicKeyPem, privateKey } = keyPair();
  const signatureB64 = sign("sha256", Buffer.from(JSON.stringify(payload), "utf8"), privateKey).toString("base64");
  const result = verifyReleaseSigner({
    payload,
    env: {
      MAATAA_RELEASE_HSM_PUBLIC_KEY_PEM: "/keys/release.pem",
      MAATAA_RELEASE_HSM_SIGNATURE_B64: signatureB64,
    },
    fileReader: (path) => (path === "/keys/release.pem" ? publicKeyPem : ""),
  });

  assert.equal(result.verified.length, 1);
  assert.equal(result.verified[0].provider_type, "external-hsm-release-signer");
});

test("operator approval quorum requires distinct signed approvals", () => {
  const root = tempRoot();
  const payload = createReleaseManifestPayload({ root, generatedAt: "2026-05-26T00:00:00.000Z" });
  const first = enrolledApproval({ root, payload, operatorId: "brahmini", role: "Admin", signerType: "HSM" });
  const second = enrolledApproval({ root, payload, operatorId: "vishNu", role: "Producer", signerType: "TPM2" });
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

test("release authority remains blocked without signer and quorum", () => {
  const artifacts = createReleaseAuthorityArtifacts({
    root: process.cwd(),
    generatedAt: "2026-05-26T00:00:00.000Z",
    env: {},
    fileReader: () => "",
  });

  assert.equal(artifacts.authority.status, "BLOCKED");
  assert.equal(artifacts.authority.release_candidate, "BLOCKED");
  assert.equal(artifacts.authority.blockers.length > 0, true);
});

test("release authority reaches release candidate with verified signer and quorum", () => {
  const root = tempRoot();
  const generatedAt = "2026-05-26T00:00:00.000Z";
  const payload = createReleaseManifestPayload({ root, generatedAt });
  const signer = keyPair();
  const signatureB64 = sign("sha256", Buffer.from(JSON.stringify(payload), "utf8"), signer.privateKey).toString("base64");
  const first = enrolledApproval({ root, payload, operatorId: "brahmini", role: "Admin", signerType: "HSM" });
  const second = enrolledApproval({ root, payload, operatorId: "vishNu", role: "Producer", signerType: "SECURE_ENCLAVE" });
  const artifacts = createReleaseAuthorityArtifacts({
    root,
    generatedAt,
    env: {
      MAATAA_RELEASE_HSM_PUBLIC_KEY_PEM: "/keys/release.pem",
      MAATAA_RELEASE_HSM_SIGNATURE_B64: signatureB64,
      MAATAA_RELEASE_APPROVALS_JSON: JSON.stringify([first.approval, second.approval]),
      MAATAA_RELEASE_QUORUM: "2",
    },
    fileReader: (path) => (path === "/keys/release.pem" ? signer.publicKeyPem : readFileSync(path, "utf8")),
  });

  assert.equal(artifacts.authority.status, "VERIFIED");
  assert.equal(artifacts.authority.release_candidate, "GOVERNED_RELEASE_CANDIDATE");
  rmSync(root, { recursive: true, force: true });
});

test("one valid operator does not meet quorum", () => {
  const root = tempRoot();
  const generatedAt = "2026-05-26T00:00:00.000Z";
  const payload = createReleaseManifestPayload({ root, generatedAt });
  const approval = enrolledApproval({ root, payload, operatorId: "brahmini", role: "Admin", signerType: "HSM" });
  const result = verifyOperatorApprovals({
    root,
    payload,
    env: {
      MAATAA_RELEASE_APPROVALS_JSON: JSON.stringify([approval.approval]),
      MAATAA_RELEASE_QUORUM: "2",
    },
    now: generatedAt,
  });

  assert.equal(result.status, "BLOCKED");
  assert.equal(result.blockers.includes("approval quorum not met: 1/2"), true);
  rmSync(root, { recursive: true, force: true });
});

test("quorum with unverifiable signature remains blocked", () => {
  const root = tempRoot();
  const generatedAt = "2026-05-26T00:00:00.000Z";
  const payload = createReleaseManifestPayload({ root, generatedAt });
  const approval = enrolledApproval({ root, payload, operatorId: "brahmini", role: "Admin", signerType: "HSM" }).approval;
  const result = verifyOperatorApprovals({
    root,
    payload,
    env: {
      MAATAA_RELEASE_APPROVALS_JSON: JSON.stringify([{ ...approval, signature_b64: "bad" }]),
      MAATAA_RELEASE_QUORUM: "1",
    },
    now: generatedAt,
  });

  assert.equal(result.status, "BLOCKED");
  assert.equal(result.blockers.some((blocker) => blocker.includes("signature verification failed")), true);
  rmSync(root, { recursive: true, force: true });
});

test("revoked operator approval remains blocked", () => {
  const root = tempRoot();
  const generatedAt = "2026-05-26T00:00:00.000Z";
  const payload = createReleaseManifestPayload({ root, generatedAt });
  const approval = enrolledApproval({ root, payload, operatorId: "brahmini", role: "Admin", signerType: "HSM" });
  const revoked = revokeOperator({ root, operatorId: "brahmini", registry: approval.registry });
  writeOperatorRegistry({ root, registry: revoked.registry });
  const result = verifyOperatorApprovals({
    root,
    payload,
    env: {
      MAATAA_RELEASE_APPROVALS_JSON: JSON.stringify([approval.approval]),
      MAATAA_RELEASE_QUORUM: "1",
    },
    now: generatedAt,
  });

  assert.equal(result.status, "BLOCKED");
  assert.equal(result.blockers.some((blocker) => blocker.includes("operator is revoked")), true);
  rmSync(root, { recursive: true, force: true });
});

test("BLOCKED signer type cannot satisfy operator quorum", () => {
  const root = tempRoot();
  const generatedAt = "2026-05-26T00:00:00.000Z";
  const payload = createReleaseManifestPayload({ root, generatedAt });
  const approval = enrolledApproval({ root, payload, operatorId: "mahesh", role: "Viewer", signerType: "BLOCKED" });
  const result = verifyOperatorApprovals({
    root,
    payload,
    env: {
      MAATAA_RELEASE_APPROVALS_JSON: JSON.stringify([approval.approval]),
      MAATAA_RELEASE_QUORUM: "1",
    },
    now: generatedAt,
  });

  assert.equal(result.status, "BLOCKED");
  assert.equal(result.blockers.some((blocker) => blocker.includes("hardware-backed signer is required")), true);
  rmSync(root, { recursive: true, force: true });
});

test("release verify blocks unsigned artifacts on disk", async () => {
  const { verifyReleaseAuthority } = await import("../scripts/release-authority/verify-release.mjs");
  const dir = join(tmpdir(), `maataa-release-authority-${process.pid}`);
  mkdirSync(join(dir, "release/release-authority"), { recursive: true });
  writeFileSync(join(dir, "release/release-authority/signed-release-manifest.json"), JSON.stringify({ schema: "bad" }), "utf8");
  writeFileSync(join(dir, "release/release-authority/release-authority.json"), JSON.stringify({ status: "BLOCKED" }), "utf8");
  const result = verifyReleaseAuthority({ root: dir });
  rmSync(dir, { recursive: true, force: true });

  assert.equal(result.status, "BLOCKED");
  assert.equal(result.failures.length > 0, true);
});

function enrolledApproval({ root, payload, operatorId, role, signerType }) {
  const { publicKeyPem, privateKey } = keyPair();
  const approvedAt = "2026-05-26T00:00:00.000Z";
  const approvalPayload = createOperatorApprovalPayload({
    release_manifest_hash: payload.manifest_hash,
    releaseManifestHash: payload.manifest_hash,
    operatorId,
    role,
    nonce: `${operatorId}-nonce`,
    approvedAt,
    expiresAt: "2026-05-26T00:15:00.000Z",
  });
  const enrolled = enrollOperator({
    root,
    operatorId,
    role,
    signerType,
    publicKeyPem,
  });
  writeOperatorRegistry({ root, registry: enrolled.registry });
  const signedPayload = JSON.stringify(approvalPayload);
  return {
    publicKeyPem,
    registry: enrolled.registry,
    approval: createOperatorApproval({
      payload: approvalPayload,
      signatureB64: sign("sha256", Buffer.from(signedPayload, "utf8"), privateKey).toString("base64"),
    }),
  };
}

function tempRoot() {
  const dir = join(tmpdir(), `maataa-operator-quorum-${process.pid}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "0.1.0-test" }), "utf8");
  return dir;
}
