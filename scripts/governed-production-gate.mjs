#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HARDWARE_ROOT_SCHEMA, STATUS_CAPTURED, computeHardwareEvidenceHash } from "./capture-hardware-root-of-trust.mjs";
import { verifyReleaseAuthority } from "./release-authority/verify-release.mjs";

export const GOVERNED_GO = "GOVERNED_PRODUCTION_GO";
export const GOVERNED_NO_GO = "GOVERNED_PRODUCTION_NO_GO";
export const GOVERNED_RELEASE_CANDIDATE = "GOVERNED_RELEASE_CANDIDATE";

export function validateHardwareRootEvidence(evidence) {
  const failures = [];

  if (!evidence || typeof evidence !== "object") {
    return {
      ok: false,
      failures: ["hardware evidence artifact is missing"],
      normalized: null,
    };
  }

  const normalized = {
    schema: evidence.schema,
    status: evidence.status,
    productionReady: evidence.production_ready === true,
    capturedAt: evidence.captured_at,
    hostPlatform: evidence.host_platform,
    trustSources: Array.isArray(evidence.trust_sources) ? evidence.trust_sources : [],
    missingSources: Array.isArray(evidence.missing_sources) ? evidence.missing_sources : [],
    evidenceHash: evidence.evidence_hash,
    phkdVerdict: evidence.phkd_verdict,
    blockers: Array.isArray(evidence.blockers) ? evidence.blockers : [],
    rawCommandSummary: Array.isArray(evidence.raw_command_summary) ? evidence.raw_command_summary : [],
    noFakeClaims: evidence.no_fake_claims === true,
  };

  if (normalized.schema !== HARDWARE_ROOT_SCHEMA) {
    failures.push("hardware root evidence schema mismatch");
  }
  if (normalized.status !== STATUS_CAPTURED) {
    failures.push(`hardware root evidence status must be ${STATUS_CAPTURED}; found ${String(normalized.status ?? "MISSING")}`);
  }
  if (normalized.productionReady !== true) {
    failures.push("hardware root evidence production_ready must be true");
  }
  if (!Number.isFinite(Date.parse(normalized.capturedAt))) {
    failures.push("hardware root captured_at must be an ISO timestamp");
  }
  if (!normalized.hostPlatform || typeof normalized.hostPlatform !== "object") {
    failures.push("hardware root host_platform is required");
  }
  if (normalized.trustSources.length === 0) {
    failures.push("hardware root trust_sources must be non-empty");
  }
  if (typeof normalized.evidenceHash !== "string" || normalized.evidenceHash.length < 32) {
    failures.push("hardware root evidence_hash is required");
  } else {
    const { evidence_hash: _hash, ...payload } = evidence;
    const expectedHash = computeHardwareEvidenceHash(payload);
    if (normalized.evidenceHash !== expectedHash) {
      failures.push("hardware root evidence_hash does not match artifact payload");
    }
  }
  if (normalized.noFakeClaims !== true) {
    failures.push("hardware root no_fake_claims must be true");
  }
  if (normalized.blockers.length > 0) {
    failures.push("hardware root blockers must be empty before GO");
  }
  if (normalized.phkdVerdict !== "PASS") {
    failures.push("hardware root phkd_verdict must be PASS");
  }

  return {
    ok: failures.length === 0,
    failures,
    normalized,
  };
}

export function evaluateGovernedProduction({ completion, hardening, hardwareEvidence }) {
  const blockers = [];
  const hardware = validateHardwareRootEvidence(hardwareEvidence);

  if (completion.productionReady !== true || completion.finalStatus !== "GO") {
    blockers.push({
      surface: "completion",
      reason: `completion matrix is ${completion.finalStatus}; productionReady=${completion.productionReady}`,
    });
  }

  if (hardening.productionReady !== true || hardening.phkdVerdict !== "PASS") {
    blockers.push({
      surface: "hardening",
      reason: `hardening matrix is ${hardening.phkdVerdict}; productionReady=${hardening.productionReady}`,
    });
  }

  if (!hardware.ok) {
    blockers.push(
      ...hardware.failures.map((reason) => ({
        surface: "hardware-root-of-trust",
        reason,
      })),
    );
  }

  return {
    status: blockers.length === 0 ? GOVERNED_GO : GOVERNED_NO_GO,
    productionReady: blockers.length === 0,
    blockers,
    hardware,
  };
}

export function createGovernedGateReport({ root = process.cwd(), generatedAt = new Date().toISOString() } = {}) {
  const completion = readJson(join(root, "COMPLETION_STATUS_MATRIX.json"));
  const hardening = readJson(join(root, "release/reports/PRODUCTION_HARDENING_MATRIX.json"));
  const hardwareEvidencePath = join(root, "release/evidence/hardware-root-of-trust.json");
  const hardwareEvidence = existsSync(hardwareEvidencePath) ? readJson(hardwareEvidencePath) : null;
  const evaluation = evaluateGovernedProduction({ completion, hardening, hardwareEvidence });
  const releaseAuthority = verifyReleaseAuthority({ root });
  const governedStatus = evaluation.productionReady
    ? GOVERNED_GO
    : releaseAuthority.status === "VERIFIED"
      ? GOVERNED_RELEASE_CANDIDATE
      : GOVERNED_NO_GO;
  const canonicalPayload = {
    schema: "maataa.governed.production.gate.v1",
    generatedAt,
    status: governedStatus,
    productionReady: evaluation.productionReady,
    phkdVerdict: evaluation.productionReady ? "PASS" : governedStatus === GOVERNED_RELEASE_CANDIDATE ? "RELEASE_CANDIDATE" : "BLOCKED",
    inputs: {
      completionMatrix: sha256File(join(root, "COMPLETION_STATUS_MATRIX.json")),
      hardeningMatrix: sha256File(join(root, "release/reports/PRODUCTION_HARDENING_MATRIX.json")),
      hardwareRootOfTrust: existsSync(hardwareEvidencePath) ? sha256File(hardwareEvidencePath) : null,
      releaseAuthority: existsSync(join(root, "release/release-authority/release-authority.json"))
        ? sha256File(join(root, "release/release-authority/release-authority.json"))
        : null,
    },
    releaseAuthority,
    hardwareEvidence: evaluation.hardware.normalized,
    blockers: evaluation.blockers,
  };

  return {
    ...canonicalPayload,
    signature: sha256Json(canonicalPayload),
  };
}

export function writeGovernedGateReport({ root = process.cwd() } = {}) {
  const report = createGovernedGateReport({ root });
  const jsonPath = join(root, "release/evidence/governed-production-gate.json");
  const mdPath = join(root, "release/evidence/governed-production-gate.md");
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeJson(jsonPath, report);
  writeFileSync(mdPath, renderMarkdown(report), "utf8");
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = writeGovernedGateReport();
  console.log(`GOVERNED_STATUS=${report.status}`);
  console.log(`PRODUCTION_READY=${report.productionReady}`);
  console.log(`PHKD_VERDICT=${report.phkdVerdict}`);
  console.log(`BLOCKERS=${report.blockers.length}`);
  if (!report.productionReady) {
    process.exitCode = 1;
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sha256Json(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function renderMarkdown(report) {
  return [
    "# Governed Production Gate",
    "",
    `Generated: ${report.generatedAt}`,
    `Status: ${report.status}`,
    `Production ready: ${report.productionReady}`,
    `PHKD verdict: ${report.phkdVerdict}`,
    `Signature: ${report.signature}`,
    "",
    "## Inputs",
    "",
    `- Completion matrix: ${report.inputs.completionMatrix}`,
    `- Hardening matrix: ${report.inputs.hardeningMatrix}`,
    `- Hardware root of trust: ${report.inputs.hardwareRootOfTrust ?? "MISSING"}`,
    `- Release authority: ${report.inputs.releaseAuthority ?? "MISSING"}`,
    "",
    "## Release Authority",
    "",
    `- Status: ${report.releaseAuthority.status}`,
    `- Release candidate: ${report.releaseAuthority.release_candidate}`,
    `- Failures: ${report.releaseAuthority.failures.length}`,
    "",
    "## Hardware Root Of Trust",
    "",
    report.hardwareEvidence
      ? `- Status: ${report.hardwareEvidence.status}`
      : "- Status: MISSING",
    report.hardwareEvidence
      ? `- Trust sources: ${report.hardwareEvidence.trustSources.length}`
      : "- Trust sources: 0",
    report.hardwareEvidence
      ? `- Evidence hash: ${report.hardwareEvidence.evidenceHash ?? "MISSING"}`
      : "- Evidence hash: MISSING",
    "",
    "## Blockers",
    "",
    ...(report.blockers.length === 0 ? ["- none"] : report.blockers.map((blocker) => `- ${blocker.surface}: ${blocker.reason}`)),
    "",
  ].join("\n");
}
