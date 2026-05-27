#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { arch, platform, release, type } from "node:os";
import { fileURLToPath } from "node:url";
import { createAttestationChallenge, sha256Json } from "./contract.mjs";
import { runAttestationAdapters, summarizeAttestationResults } from "./providers.mjs";

export function createHardwareAttestationReport({
  root = process.cwd(),
  capturedAt = new Date().toISOString(),
  hostPlatform = detectHostPlatform(),
  env = process.env,
  commandRunner,
  pathExists,
  fileReader,
  nonce,
  replayCachePath = join(root, "release/evidence/hardware-attestation-replay-cache.json"),
} = {}) {
  const challenge = createAttestationChallenge({
    hostPlatform,
    capturedAt,
    nonce,
    evidenceBindingSeed: `${hostPlatform.platform}:${hostPlatform.arch}:${capturedAt}`,
  });
  const results = runAttestationAdapters({
    challenge,
    hostPlatform,
    root,
    env,
    commandRunner,
    pathExists,
    fileReader,
    replayCachePath,
  });
  const summary = summarizeAttestationResults(results);
  const payload = {
    schema: "maataa.hardware.attestation.report.v1",
    captured_at: capturedAt,
    host_platform: hostPlatform,
    challenge,
    status: summary.verified.length > 0 ? "CAPTURED" : results.some((result) => result.status !== "UNAVAILABLE") ? "BLOCKED" : "PARTIAL",
    verified_provider_count: summary.verified.length,
    providers: results,
    phkd_verdict: summary.verified.length > 0 ? "PASS" : "BLOCKED",
    no_fake_claims: true,
  };

  return {
    ...payload,
    evidence_hash: sha256Json(payload),
  };
}

export function writeHardwareAttestationReport({ root = process.cwd(), report = createHardwareAttestationReport({ root }) } = {}) {
  const jsonPath = join(root, "release/evidence/hardware-attestation.json");
  const mdPath = join(root, "release/evidence/hardware-attestation.md");
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(mdPath, renderMarkdown(report), "utf8");
  return { report, jsonPath, mdPath };
}

function renderMarkdown(report) {
  return [
    "# Hardware Attestation",
    "",
    `Captured: ${report.captured_at}`,
    `Status: ${report.status}`,
    `Verified providers: ${report.verified_provider_count}`,
    `PHKD verdict: ${report.phkd_verdict}`,
    `Evidence hash: ${report.evidence_hash}`,
    "",
    "## Providers",
    "",
    ...report.providers.map((provider) => `- ${provider.provider_id} (${provider.provider_type}): ${provider.status} - ${provider.reason}`),
    "",
  ].join("\n");
}

function detectHostPlatform() {
  return {
    platform: platform(),
    arch: arch(),
    os_type: type(),
    os_release: release(),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { report, jsonPath, mdPath } = writeHardwareAttestationReport();
  console.log(`HARDWARE_ATTESTATION_STATUS=${report.status}`);
  console.log(`VERIFIED_PROVIDERS=${report.verified_provider_count}`);
  console.log(`PHKD_VERDICT=${report.phkd_verdict}`);
  console.log(`JSON=${jsonPath}`);
  console.log(`MARKDOWN=${mdPath}`);
  if (report.verified_provider_count === 0) {
    process.exitCode = 1;
  }
}
