#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import {
  RELEASE_AUTHORITY_BLOCKED,
  RELEASE_AUTHORITY_SCHEMA,
  RELEASE_AUTHORITY_VERIFIED,
  RELEASE_CANDIDATE,
  SIGNED_RELEASE_MANIFEST_SCHEMA,
  createReleaseManifestPayload,
  sha256Json,
  verifyOperatorApprovals,
  verifyReleaseSigner,
  writeReleaseAuthorityArtifacts,
} from "./contract.mjs";

export function createReleaseAuthorityArtifacts({
  root = process.cwd(),
  generatedAt = new Date().toISOString(),
  env = process.env,
  fileReader,
  commit = process.env.GIT_COMMIT || "unknown",
} = {}) {
  const payload = createReleaseManifestPayload({ root, generatedAt, commit });
  const signer = verifyReleaseSigner({ payload, env, fileReader });
  const operatorApproval = verifyOperatorApprovals({ root, payload, env, fileReader, now: generatedAt });
  const blockers = [
    ...signer.blocked.map((result) => `${result.provider_id}: ${result.reason}`),
    ...operatorApproval.blockers.map((blocker) => `operator-approval: ${blocker}`),
  ];
  const hasVerifiedSigner = signer.verified.length > 0;
  const hasVerifiedQuorum = operatorApproval.status === RELEASE_AUTHORITY_VERIFIED;
  const status = hasVerifiedSigner && hasVerifiedQuorum ? RELEASE_AUTHORITY_VERIFIED : RELEASE_AUTHORITY_BLOCKED;
  const releaseCandidate = status === RELEASE_AUTHORITY_VERIFIED ? RELEASE_CANDIDATE : "BLOCKED";
  const signedManifest = {
    schema: SIGNED_RELEASE_MANIFEST_SCHEMA,
    generated_at: generatedAt,
    status,
    release_candidate: releaseCandidate,
    payload,
    signer: hasVerifiedSigner ? signer.verified[0] : null,
    signer_results: signer.signer_results,
    operator_approval: operatorApproval,
    no_fake_signatures: true,
  };
  const authority = {
    schema: RELEASE_AUTHORITY_SCHEMA,
    generated_at: generatedAt,
    status,
    release_candidate: releaseCandidate,
    signed_release_manifest_hash: sha256Json(signedManifest),
    signer,
    operator_approval: operatorApproval,
    blockers,
    phkd_verdict: status === RELEASE_AUTHORITY_VERIFIED ? "PASS" : "BLOCKED",
    no_unsigned_production_release: true,
    no_fake_signatures: true,
  };
  const lineage = {
    schema: "maataa.release.lineage.v1",
    generated_at: generatedAt,
    entries: [
      {
        release_manifest_hash: payload.manifest_hash,
        signed_release_manifest_hash: authority.signed_release_manifest_hash,
        authority_status: authority.status,
        release_candidate: authority.release_candidate,
      },
    ],
  };
  const operatorApprovalLog = {
    schema: "maataa.release.operator-approval-log.v1",
    generated_at: generatedAt,
    quorum: operatorApproval.quorum,
    verified_count: operatorApproval.verified_count,
    approvals: operatorApproval.approvals,
    blockers: operatorApproval.blockers,
  };
  const certificateRegistry = {
    schema: "maataa.release.certificate-registry.v1",
    generated_at: generatedAt,
    certificates: signer.verified.map((result) => ({
      provider_id: result.provider_id,
      provider_type: result.provider_type,
      public_key_sha256: result.public_key_sha256,
      certificate_sha256: result.certificate_sha256,
    })),
  };

  return { authority, signedManifest, lineage, operatorApprovalLog, certificateRegistry };
}

export function writeReleaseAuthority({ root = process.cwd(), artifacts = createReleaseAuthorityArtifacts({ root }) } = {}) {
  writeReleaseAuthorityArtifacts({ root, artifacts });
  return artifacts;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const artifacts = writeReleaseAuthority();
  console.log(`RELEASE_AUTHORITY_STATUS=${artifacts.authority.status}`);
  console.log(`RELEASE_CANDIDATE=${artifacts.authority.release_candidate}`);
  console.log(`VERIFIED_SIGNERS=${artifacts.authority.signer.verified.length}`);
  console.log(`APPROVAL_QUORUM=${artifacts.authority.operator_approval.verified_count}/${artifacts.authority.operator_approval.quorum}`);
  console.log(`BLOCKERS=${artifacts.authority.blockers.length}`);
  if (artifacts.authority.status !== RELEASE_AUTHORITY_VERIFIED) {
    process.exitCode = 1;
  }
}
