#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { arch, platform, release, type } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createAttestationChallenge } from "./hardware-attestation/contract.mjs";
import { runAttestationAdapters, summarizeAttestationResults } from "./hardware-attestation/providers.mjs";

export const HARDWARE_ROOT_SCHEMA = "maataa.hardware.root-of-trust.capture.v1";
export const STATUS_CAPTURED = "CAPTURED";
export const STATUS_PARTIAL = "PARTIAL";
export const STATUS_BLOCKED = "BLOCKED";
export const MMIO_WINDOW = "0xFE001000";

export function createHardwareRootEvidence({
  root = process.cwd(),
  capturedAt = new Date().toISOString(),
  hostPlatform = detectHostPlatform(),
  commandRunner = runCommand,
  fileReader = readLocalFile,
  pathExists = existsSync,
  env = process.env,
  replayCachePath = null,
  nonce,
} = {}) {
  const rawCommandSummary = [];
  const trustSources = [];
  const missingSources = [];

  const recordCommand = (id, command, args, options = {}) => {
    const result = commandRunner(command, args, options);
    rawCommandSummary.push(summarizeCommand(result));
    if (result.ok && result.stdout.trim().length > 0) {
      return result.stdout;
    }
    return "";
  };

  const addSource = ({ id, type: sourceType, status, raw, summary }) => {
    if (!raw || raw.trim().length === 0) {
      missingSources.push(`${id}: unavailable`);
      return;
    }

    trustSources.push({
      id,
      type: sourceType,
      status,
      summary,
      evidence_sha256: sha256Text(raw),
    });
  };

  const addMissing = (reason) => {
    if (!missingSources.includes(reason)) {
      missingSources.push(reason);
    }
  };

  if (hostPlatform.platform === "darwin") {
    const hardware = recordCommand("macos-system-profiler-hardware", "system_profiler", ["SPHardwareDataType"], { timeoutMs: 8000 });
    addSource({
      id: "macos-system-profiler-hardware",
      type: "host-identity",
      status: hardware ? "CAPTURED_HASHED" : "MISSING",
      raw: hardware,
      summary: "macOS hardware profile captured as a local SHA-256 digest",
    });

    const bridge = recordCommand("macos-system-profiler-ibridge", "system_profiler", ["SPiBridgeDataType"], { timeoutMs: 8000 });
    if (/Secure Enclave|Apple T2|iBridge/i.test(bridge)) {
      addSource({
        id: "macos-secure-enclave-signal",
        type: "secure-enclave-signal",
        status: "CAPTURED_HASHED",
        raw: bridge,
        summary: "macOS iBridge or Secure Enclave signal captured as a local SHA-256 digest",
      });
    } else {
      addMissing("macOS Secure Enclave attestation is not exposed to this process");
    }

    const ioreg = recordCommand("macos-ioreg-platform", "ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"], { timeoutMs: 5000 });
    addSource({
      id: "macos-ioreg-platform",
      type: "machine-uuid-signal",
      status: ioreg ? "CAPTURED_HASHED" : "MISSING",
      raw: ioreg,
      summary: "IOPlatformExpertDevice identity material captured as a local SHA-256 digest",
    });

    const csr = recordCommand("macos-csrutil-status", "csrutil", ["status"], { timeoutMs: 5000 });
    addSource({
      id: "macos-boot-security-mode",
      type: "boot-security-signal",
      status: csr ? "CAPTURED_HASHED" : "MISSING",
      raw: csr,
      summary: "macOS SIP status captured as a local SHA-256 digest",
    });

    const cpu = recordCommand("macos-cpu-brand", "sysctl", ["-n", "machdep.cpu.brand_string"], { timeoutMs: 3000 });
    addSource({
      id: "macos-cpu-identity",
      type: "cpu-identity",
      status: cpu ? "CAPTURED_HASHED" : "MISSING",
      raw: cpu,
      summary: "CPU brand identity captured as a local SHA-256 digest",
    });
  } else if (hostPlatform.platform === "linux") {
    const tpmPaths = ["/sys/class/tpm", "/dev/tpm0", "/dev/tpmrm0"].filter(pathExists);
    if (tpmPaths.length > 0) {
      addSource({
        id: "linux-tpm-device-presence",
        type: "tpm-presence",
        status: "CAPTURED_HASHED",
        raw: tpmPaths.join("\n"),
        summary: "Linux TPM device paths detected locally",
      });
    } else {
      addMissing("Linux TPM device paths are not present");
    }

    const productUuid = fileReader("/sys/class/dmi/id/product_uuid");
    addSource({
      id: "linux-dmi-product-uuid",
      type: "machine-uuid-signal",
      status: productUuid ? "CAPTURED_HASHED" : "MISSING",
      raw: productUuid,
      summary: "DMI product UUID captured as a local SHA-256 digest",
    });

    const secureBootVars = pathExists("/sys/firmware/efi/efivars") ? "efi-variables-present" : "";
    addSource({
      id: "linux-efi-secure-boot-signal",
      type: "boot-security-signal",
      status: secureBootVars ? "CAPTURED_HASHED" : "MISSING",
      raw: secureBootVars,
      summary: "EFI variable directory presence captured as a local SHA-256 digest",
    });

    const cpuInfo = fileReader("/proc/cpuinfo");
    addSource({
      id: "linux-cpuinfo",
      type: "cpu-identity",
      status: cpuInfo ? "CAPTURED_HASHED" : "MISSING",
      raw: cpuInfo,
      summary: "CPU information captured as a local SHA-256 digest",
    });
  } else {
    addMissing(`host trust source detection is not implemented for ${hostPlatform.platform}`);
  }

  const attestationChallenge = createAttestationChallenge({
    hostPlatform,
    capturedAt,
    nonce,
    evidenceBindingSeed: trustSources.map((source) => source.evidence_sha256).join(":"),
  });
  const attestationResults = runAttestationAdapters({
    challenge: attestationChallenge,
    hostPlatform,
    root,
    env,
    commandRunner,
    pathExists,
    fileReader,
    replayCachePath,
  });
  const attestationSummary = summarizeAttestationResults(attestationResults);

  for (const provider of attestationSummary.verified) {
    trustSources.push({
      id: provider.provider_id,
      type: provider.provider_type,
      status: "VERIFIED_ATTESTATION",
      summary: provider.reason,
      evidence_sha256: provider.record?.challenge_hash ?? provider.record?.signature_sha256 ?? "",
    });
  }

  for (const provider of [...attestationSummary.unavailable, ...attestationSummary.failed]) {
    addMissing(`${provider.provider_id}: ${provider.reason}`);
  }

  addMissing(`direct MMIO window ${MMIO_WINDOW} is not safely accessible from this host process`);
  if (attestationSummary.verified.length === 0) {
    addMissing("hardware-fused attestation quote is not available to this local Node.js capture process");
  }

  const blockers = deriveBlockers({ trustSources, missingSources });
  const status = deriveStatus({ trustSources, blockers });
  const productionReady = status === STATUS_CAPTURED && blockers.length === 0;

  const payload = {
    schema: HARDWARE_ROOT_SCHEMA,
    status,
    production_ready: productionReady,
    captured_at: capturedAt,
    host_platform: hostPlatform,
    trust_sources: trustSources,
    missing_sources: missingSources,
    phkd_verdict: productionReady ? "PASS" : "BLOCKED",
    blockers,
    attestation_challenge: attestationChallenge,
    attestation_results: attestationResults,
    raw_command_summary: rawCommandSummary,
    no_fake_claims: true,
  };

  return {
    ...payload,
    evidence_hash: computeHardwareEvidenceHash(payload),
  };
}

export function writeHardwareRootEvidence({ root = process.cwd(), evidence = createHardwareRootEvidence({ root }) } = {}) {
  const jsonPath = join(root, "release/evidence/hardware-root-of-trust.json");
  const mdPath = join(root, "release/evidence/hardware-root-of-trust.md");
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeJson(jsonPath, evidence);
  writeFileSync(mdPath, renderHardwareEvidenceMarkdown(evidence), "utf8");
  return { evidence, jsonPath, mdPath };
}

export function validateHardwareEvidenceHash(evidence) {
  if (!evidence || typeof evidence !== "object" || typeof evidence.evidence_hash !== "string") {
    return false;
  }
  const { evidence_hash: _hash, ...payload } = evidence;
  return evidence.evidence_hash === computeHardwareEvidenceHash(payload);
}

export function computeHardwareEvidenceHash(payload) {
  const normalized = canonicalize(payload);
  return sha256Text(JSON.stringify(normalized));
}

export function deriveStatus({ trustSources, blockers }) {
  if (trustSources.length === 0) {
    return STATUS_BLOCKED;
  }
  if (blockers.length > 0) {
    return STATUS_PARTIAL;
  }
  return STATUS_CAPTURED;
}

export function deriveBlockers({ trustSources, missingSources }) {
  const blockers = [];
  const hasVerifiedAttestation = trustSources.some((source) => source.status === "VERIFIED_ATTESTATION");

  if (trustSources.length === 0) {
    blockers.push({
      id: "NO_TRUST_SOURCES_CAPTURED",
      reason: "No host trust source could be captured on this machine.",
    });
  }

  if (!hasVerifiedAttestation && missingSources.some((source) => /attestation quote|attestation material|adapter|TPM2|HSM|Secure Enclave/i.test(source))) {
    blockers.push({
      id: "HARDWARE_ATTESTATION_QUOTE_MISSING",
      reason: "No TPM, Secure Enclave, HSM, or factory-fused attestation quote was exposed to this process.",
    });
  }

  return blockers;
}

function detectHostPlatform() {
  return {
    platform: platform(),
    arch: arch(),
    os_type: type(),
    os_release: release(),
  };
}

function runCommand(command, args, { timeoutMs = 4000 } = {}) {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024,
  });

  return {
    command,
    args,
    ok: result.status === 0 && !result.error,
    exitCode: typeof result.status === "number" ? result.status : null,
    signal: result.signal ?? null,
    error: result.error ? result.error.message : null,
    durationMs: Date.now() - startedAt,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function summarizeCommand(result) {
  return {
    command: [result.command, ...result.args].join(" "),
    ok: result.ok,
    exit_code: result.exitCode,
    signal: result.signal,
    duration_ms: result.durationMs,
    stdout_sha256: sha256Text(result.stdout ?? ""),
    stderr_sha256: sha256Text(result.stderr ?? ""),
    stdout_bytes: Buffer.byteLength(result.stdout ?? "", "utf8"),
    stderr_bytes: Buffer.byteLength(result.stderr ?? "", "utf8"),
    error: result.error,
  };
}

function readLocalFile(path) {
  try {
    if (!existsSync(path) || !statSync(path).isFile()) {
      return "";
    }
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
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

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function renderHardwareEvidenceMarkdown(evidence) {
  return [
    "# Hardware Root Of Trust Evidence",
    "",
    `Captured: ${evidence.captured_at}`,
    `Status: ${evidence.status}`,
    `Production ready: ${evidence.production_ready}`,
    `PHKD verdict: ${evidence.phkd_verdict}`,
    `Evidence hash: ${evidence.evidence_hash}`,
    `No fake claims: ${evidence.no_fake_claims}`,
    "",
    "## Host Platform",
    "",
    `- Platform: ${evidence.host_platform.platform}`,
    `- Architecture: ${evidence.host_platform.arch}`,
    `- OS release: ${evidence.host_platform.os_release}`,
    "",
    "## Trust Sources",
    "",
    ...(evidence.trust_sources.length === 0
      ? ["- none"]
      : evidence.trust_sources.map((source) => `- ${source.id} (${source.type}): ${source.status} ${source.evidence_sha256}`)),
    "",
    "## Missing Sources",
    "",
    ...(evidence.missing_sources.length === 0 ? ["- none"] : evidence.missing_sources.map((source) => `- ${source}`)),
    "",
    "## Blockers",
    "",
    ...(evidence.blockers.length === 0 ? ["- none"] : evidence.blockers.map((blocker) => `- ${blocker.id}: ${blocker.reason}`)),
    "",
    "## Attestation Providers",
    "",
    ...((evidence.attestation_results ?? []).length === 0
      ? ["- none"]
      : evidence.attestation_results.map((provider) => `- ${provider.provider_id} (${provider.provider_type}): ${provider.status} - ${provider.reason}`)),
    "",
    "## Raw Command Summary",
    "",
    ...(evidence.raw_command_summary.length === 0
      ? ["- none"]
      : evidence.raw_command_summary.map((entry) => `- ${entry.command}: ok=${entry.ok} stdout=${entry.stdout_bytes}B stderr=${entry.stderr_bytes}B`)),
    "",
  ].join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { evidence, jsonPath, mdPath } = writeHardwareRootEvidence();
  console.log(`HARDWARE_ROOT_STATUS=${evidence.status}`);
  console.log(`PRODUCTION_READY=${evidence.production_ready}`);
  console.log(`PHKD_VERDICT=${evidence.phkd_verdict}`);
  console.log(`TRUST_SOURCES=${evidence.trust_sources.length}`);
  console.log(`BLOCKERS=${evidence.blockers.length}`);
  console.log(`JSON=${jsonPath}`);
  console.log(`MARKDOWN=${mdPath}`);
}
