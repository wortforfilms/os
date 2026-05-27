#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { createReleaseManifestPayload } from "./contract.mjs";
import {
  appendOperatorApproval,
  createOperatorApproval,
  createOperatorApprovalPayload,
  readOperatorRegistry,
  verifyOperatorApprovalAgainstRegistry,
} from "./operator-registry.mjs";

export function approveReleaseFromEnv({ root = process.cwd(), env = process.env, now = new Date().toISOString() } = {}) {
  const payload = createReleaseManifestPayload({ root, generatedAt: env.MAATAA_RELEASE_GENERATED_AT || now, commit: env.GIT_COMMIT || "unknown" });
  const approvalPayload = createOperatorApprovalPayload({
    releaseManifestHash: payload.manifest_hash,
    operatorId: env.MAATAA_OPERATOR_ID,
    role: env.MAATAA_OPERATOR_ROLE,
    nonce: env.MAATAA_RELEASE_APPROVAL_NONCE,
    approvedAt: env.MAATAA_RELEASE_APPROVED_AT || now,
    expiresAt: env.MAATAA_RELEASE_APPROVAL_EXPIRES_AT,
  });

  if (process.argv.includes("--payload")) {
    return { ok: true, mode: "payload", payload: approvalPayload };
  }

  const approval = createOperatorApproval({
    payload: approvalPayload,
    signatureB64: env.MAATAA_OPERATOR_APPROVAL_SIGNATURE_B64,
  });
  const registry = readOperatorRegistry({ root });
  const verification = verifyOperatorApprovalAgainstRegistry({
    approval,
    releaseManifestHash: payload.manifest_hash,
    registry,
    now,
  });

  if (verification.status !== "VERIFIED") {
    return { ok: false, mode: "approve", approval, verification };
  }

  const written = appendOperatorApproval({ root, approval });
  return { ok: true, mode: "approve", approval, verification, written };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = approveReleaseFromEnv();
  if (result.mode === "payload") {
    console.log(JSON.stringify(result.payload, null, 2));
  } else {
    console.log(`OPERATOR_APPROVAL_STATUS=${result.ok ? "PASS" : "BLOCKED"}`);
    console.log(`OPERATOR_ID=${result.approval?.operator_id ?? "MISSING"}`);
    if (!result.ok) {
      console.log(`REASON=${result.verification.reason}`);
      process.exitCode = 1;
    }
  }
}
