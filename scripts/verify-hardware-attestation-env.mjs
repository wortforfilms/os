#!/usr/bin/env node
import { existsSync, statSync } from "node:fs";
import { platform, arch, release, type } from "node:os";
import { spawnSync } from "node:child_process";

const STATUS_PASS = "PASS";
const STATUS_PARTIAL = "PARTIAL";
const STATUS_BLOCKED = "BLOCKED";

export function evaluateHardwareAttestationEnv({
  hostPlatform = detectHostPlatform(),
  env = process.env,
  commandRunner = runCommand,
  pathExists = existsSync,
} = {}) {
  const checks = [
    checkTpm2({ hostPlatform, commandRunner, pathExists }),
    checkMacSecureEnclave({ hostPlatform, commandRunner }),
    checkExternalHsmEnv({ env, pathExists }),
  ];

  const readyProviders = checks.filter((check) => check.status === STATUS_PASS);
  const reachableProviders = checks.filter((check) => check.status === STATUS_PASS || check.status === STATUS_PARTIAL);
  const status = readyProviders.length > 0 ? STATUS_PASS : reachableProviders.length > 0 ? STATUS_PARTIAL : STATUS_BLOCKED;
  const remediation = checks.flatMap((check) => check.remediation.map((step) => `${check.provider}: ${step}`));

  return {
    schema: "maataa.hardware.attestation.env.v1",
    checked_at: new Date().toISOString(),
    status,
    production_gate_unchanged: true,
    host_platform: hostPlatform,
    ready_provider_count: readyProviders.length,
    checks,
    remediation,
    no_go_claim: true,
  };
}

export function renderText(report) {
  const lines = [
    `HARDWARE_ATTESTATION_ENV=${report.status}`,
    `READY_PROVIDERS=${report.ready_provider_count}`,
    "PRODUCTION_GATE_UNCHANGED=true",
    "",
    "Checks:",
  ];

  for (const check of report.checks) {
    lines.push(`- ${check.provider}: ${check.status}`);
    lines.push(`  ${check.summary}`);
    for (const step of check.remediation) {
      lines.push(`  remediate: ${step}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function checkTpm2({ hostPlatform, commandRunner, pathExists }) {
  if (hostPlatform.platform !== "linux") {
    return {
      provider: "linux-tpm2",
      status: STATUS_BLOCKED,
      summary: `TPM2 quote adapter requires Linux; current platform is ${hostPlatform.platform}.`,
      signals: {},
      remediation: ["Run on Linux hardware with TPM 2.0 enabled in firmware."],
    };
  }

  const tpmrm = pathExists("/dev/tpmrm0");
  const tpm0 = pathExists("/dev/tpm0");
  const sysTpm = pathExists("/sys/class/tpm");
  const tpm2Quote = commandRunner("tpm2_quote", ["--version"], { timeoutMs: 3000 });
  const tpm2Getcap = commandRunner("tpm2_getcap", ["--version"], { timeoutMs: 3000 });
  const hasTools = tpm2Quote.ok && tpm2Getcap.ok;
  const hasDevice = tpmrm || tpm0 || sysTpm;
  const status = hasTools && hasDevice ? STATUS_PASS : hasTools || hasDevice ? STATUS_PARTIAL : STATUS_BLOCKED;
  const remediation = [];

  if (!hasDevice) {
    remediation.push("Enable TPM 2.0 in firmware and verify /dev/tpmrm0 or /dev/tpm0 exists.");
  }
  if (!hasTools) {
    remediation.push("Install tpm2-tools so tpm2_quote and tpm2_getcap are available in PATH.");
  }
  remediation.push("Generate a nonce-bound quote and set MAATAA_TPM2_AK_PUBLIC_PEM, MAATAA_TPM2_QUOTE_SIGNATURE_B64, and MAATAA_TPM2_QUOTE_PATH before running npm run hardware:root.");

  return {
    provider: "linux-tpm2",
    status,
    summary: hasDevice && hasTools ? "TPM2 device and tools are visible. Quote material is still required for CAPTURED evidence." : "TPM2 environment is not fully ready.",
    signals: {
      dev_tpmrm0: tpmrm,
      dev_tpm0: tpm0,
      sys_class_tpm: sysTpm,
      tpm2_quote: tpm2Quote.ok,
      tpm2_getcap: tpm2Getcap.ok,
    },
    remediation,
  };
}

function checkMacSecureEnclave({ hostPlatform, commandRunner }) {
  if (hostPlatform.platform !== "darwin") {
    return {
      provider: "macos-secure-enclave",
      status: STATUS_BLOCKED,
      summary: `Secure Enclave adapter requires macOS; current platform is ${hostPlatform.platform}.`,
      signals: {},
      remediation: ["Run on macOS hardware with Secure Enclave or use TPM2/HSM provider on another platform."],
    };
  }

  const security = commandRunner("security", ["list-keychains"], { timeoutMs: 5000 });
  const systemProfiler = commandRunner("system_profiler", ["SPiBridgeDataType"], { timeoutMs: 8000 });
  const hasSecureSignal = /Secure Enclave|Apple T2|iBridge/i.test(systemProfiler.stdout ?? "");
  const status = security.ok && hasSecureSignal ? STATUS_PASS : security.ok || hasSecureSignal ? STATUS_PARTIAL : STATUS_BLOCKED;
  const remediation = [];

  if (!security.ok) {
    remediation.push("Ensure macOS security CLI is available and keychain access is permitted.");
  }
  if (!hasSecureSignal) {
    remediation.push("Verify the Mac exposes Secure Enclave or T2/iBridge signals to system_profiler.");
  }
  remediation.push("Create a Secure Enclave-backed key signature for the challenge and set MAATAA_SE_PUBLIC_KEY_PEM and MAATAA_SE_SIGNATURE_B64 before running npm run hardware:root.");
  remediation.push("Do not claim full silicon attestation unless the signed key challenge verifies.");

  return {
    provider: "macos-secure-enclave",
    status,
    summary: status === STATUS_PASS ? "macOS Secure Enclave/keychain command surface is visible. Signed key attestation material is still required for CAPTURED evidence." : "macOS Secure Enclave command surface is not fully ready.",
    signals: {
      security_cli: security.ok,
      spibridge_signal: hasSecureSignal,
      spibridge_stdout_bytes: Buffer.byteLength(systemProfiler.stdout ?? "", "utf8"),
    },
    remediation,
  };
}

function checkExternalHsmEnv({ env, pathExists }) {
  const publicKeyPath = env.MAATAA_HSM_PUBLIC_KEY_PEM;
  const signature = env.MAATAA_HSM_SIGNATURE_B64;
  const certificatePath = env.MAATAA_HSM_CERTIFICATE_PEM;
  const publicKeyPresent = Boolean(publicKeyPath && pathExists(publicKeyPath) && isReadableFile(publicKeyPath));
  const signaturePresent = Boolean(signature && signature.length > 32);
  const certificatePresent = Boolean(certificatePath && pathExists(certificatePath) && isReadableFile(certificatePath));
  const status = publicKeyPresent && signaturePresent ? STATUS_PASS : publicKeyPresent || signaturePresent || certificatePresent ? STATUS_PARTIAL : STATUS_BLOCKED;
  const remediation = [];

  if (!publicKeyPresent) {
    remediation.push("Set MAATAA_HSM_PUBLIC_KEY_PEM to a readable PEM public key exported from the HSM/YubiHSM.");
  }
  if (!signaturePresent) {
    remediation.push("Set MAATAA_HSM_SIGNATURE_B64 to a base64 signature over the Maataa attestation signed payload.");
  }
  remediation.push("Optionally set MAATAA_HSM_CERTIFICATE_PEM and MAATAA_HSM_PROVIDER_ID for certificate-chain metadata.");

  return {
    provider: "external-hsm",
    status,
    summary: status === STATUS_PASS ? "External HSM environment variables are present. Signature verification still happens during npm run hardware:root." : "External HSM environment is not fully configured.",
    signals: {
      public_key_path_set: Boolean(publicKeyPath),
      public_key_readable: publicKeyPresent,
      signature_set: signaturePresent,
      certificate_readable: certificatePresent,
    },
    remediation,
  };
}

function isReadableFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function detectHostPlatform() {
  return {
    platform: platform(),
    arch: arch(),
    os_type: type(),
    os_release: release(),
  };
}

function runCommand(command, args, { timeoutMs = 3000 } = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 1024 * 512,
  });
  return {
    ok: result.status === 0 && !result.error,
    status: result.status,
    error: result.error?.message ?? null,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = evaluateHardwareAttestationEnv();
  console.log(renderText(report));
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  }
  if (report.status === STATUS_BLOCKED) {
    process.exitCode = 1;
  }
}
