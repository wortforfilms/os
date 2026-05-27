import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  ATTESTATION_FAILED,
  ATTESTATION_UNAVAILABLE,
  createSignedAttestationRecord,
  createSignedPayload,
  sha256Text,
  verifyAttestationRecord,
} from "./contract.mjs";

export function runAttestationAdapters({
  challenge,
  hostPlatform,
  root = process.cwd(),
  env = process.env,
  commandRunner = runCommand,
  pathExists = existsSync,
  fileReader = readFile,
  replayCachePath = null,
} = {}) {
  const evidenceBindingHash = challenge.challenge_hash;
  const adapters = [
    createTpm2QuoteAdapter(),
    createMacSecureEnclaveAdapter(),
    createExternalHsmAdapter(),
  ];

  return adapters.map((adapter) =>
    adapter.capture({
      challenge,
      evidenceBindingHash,
      hostPlatform,
      root,
      env,
      commandRunner,
      pathExists,
      fileReader,
      replayCachePath,
    }),
  );
}

export function createTpm2QuoteAdapter() {
  return {
    id: "linux-tpm2-quote",
    providerType: "tpm2-quote",
    capture(context) {
      const { challenge, evidenceBindingHash, hostPlatform, env, commandRunner, pathExists, fileReader, replayCachePath } = context;
      const tpmPaths = ["/dev/tpmrm0", "/dev/tpm0", "/sys/class/tpm"].filter(pathExists);
      if (hostPlatform.platform !== "linux") {
        return unavailable(this, "TPM2 quote adapter is Linux-only", { platform: hostPlatform.platform });
      }
      if (tpmPaths.length === 0) {
        return unavailable(this, "No Linux TPM device path is available", {});
      }
      if (!env.MAATAA_TPM2_AK_PUBLIC_PEM || !env.MAATAA_TPM2_QUOTE_SIGNATURE_B64 || !env.MAATAA_TPM2_QUOTE_PATH) {
        return unavailable(this, "TPM2 quote material is not configured in MAATAA_TPM2_AK_PUBLIC_PEM, MAATAA_TPM2_QUOTE_SIGNATURE_B64, and MAATAA_TPM2_QUOTE_PATH", {
          tpm_paths: tpmPaths,
        });
      }

      const publicKeyPem = fileReader(env.MAATAA_TPM2_AK_PUBLIC_PEM);
      const quote = fileReader(env.MAATAA_TPM2_QUOTE_PATH);
      if (!publicKeyPem || !quote) {
        return failed(this, "Configured TPM2 quote or AK public key file is unreadable", { tpm_paths: tpmPaths });
      }

      const tools = commandRunner("tpm2_getcap", ["properties-fixed"], { timeoutMs: 5000 });
      const record = {
        ...createSignedAttestationRecord({
          providerId: this.id,
          providerType: this.providerType,
          challenge,
          evidenceBindingHash,
          publicKeyPem,
          signatureB64: env.MAATAA_TPM2_QUOTE_SIGNATURE_B64,
          quoteHash: sha256Text(quote),
          rawSummary: {
            tpm_paths: tpmPaths,
            getcap_ok: tools.ok,
            getcap_stdout_sha256: sha256Text(tools.stdout ?? ""),
            quote_sha256: sha256Text(quote),
          },
        }),
        public_key_pem: publicKeyPem,
      };

      return finalizeRecord(this, record, challenge, replayCachePath);
    },
  };
}

export function createMacSecureEnclaveAdapter() {
  return {
    id: "macos-secure-enclave-signed-key",
    providerType: "secure-enclave-signed-key",
    capture(context) {
      const { challenge, evidenceBindingHash, hostPlatform, env, commandRunner, fileReader, replayCachePath } = context;
      if (hostPlatform.platform !== "darwin") {
        return unavailable(this, "macOS Secure Enclave adapter is Darwin-only", { platform: hostPlatform.platform });
      }

      const keychain = commandRunner("security", ["list-keychains"], { timeoutMs: 5000 });
      const enclaveProbe = commandRunner("system_profiler", ["SPiBridgeDataType"], { timeoutMs: 8000 });
      const hasPresenceSignal = /Secure Enclave|Apple T2|iBridge/i.test(enclaveProbe.stdout ?? "") || keychain.ok;

      if (!hasPresenceSignal) {
        return unavailable(this, "No macOS Secure Enclave or keychain presence signal was visible", {});
      }
      if (!env.MAATAA_SE_PUBLIC_KEY_PEM || !env.MAATAA_SE_SIGNATURE_B64) {
        return unavailable(this, "Secure Enclave presence was detectable, but signed key attestation material is not configured in MAATAA_SE_PUBLIC_KEY_PEM and MAATAA_SE_SIGNATURE_B64", {
          keychain_ok: keychain.ok,
          ibridge_signal_sha256: sha256Text(enclaveProbe.stdout ?? ""),
        });
      }

      const publicKeyPem = fileReader(env.MAATAA_SE_PUBLIC_KEY_PEM);
      if (!publicKeyPem) {
        return failed(this, "Configured Secure Enclave public key file is unreadable", {});
      }

      const record = {
        ...createSignedAttestationRecord({
          providerId: this.id,
          providerType: this.providerType,
          challenge,
          evidenceBindingHash,
          publicKeyPem,
          signatureB64: env.MAATAA_SE_SIGNATURE_B64,
          rawSummary: {
            keychain_ok: keychain.ok,
            ibridge_signal_sha256: sha256Text(enclaveProbe.stdout ?? ""),
            note: "macOS presence signal plus externally supplied Secure Enclave key signature; no full silicon quote is claimed.",
          },
        }),
        public_key_pem: publicKeyPem,
      };

      return finalizeRecord(this, record, challenge, replayCachePath);
    },
  };
}

export function createExternalHsmAdapter() {
  return {
    id: "external-hsm-signature",
    providerType: "external-hsm",
    capture(context) {
      const { challenge, evidenceBindingHash, env, fileReader, replayCachePath } = context;
      if (!env.MAATAA_HSM_PUBLIC_KEY_PEM || !env.MAATAA_HSM_SIGNATURE_B64) {
        return unavailable(this, "External HSM/YubiHSM attestation material is not configured in MAATAA_HSM_PUBLIC_KEY_PEM and MAATAA_HSM_SIGNATURE_B64", {});
      }

      const publicKeyPem = fileReader(env.MAATAA_HSM_PUBLIC_KEY_PEM);
      const certificatePem = env.MAATAA_HSM_CERTIFICATE_PEM ? fileReader(env.MAATAA_HSM_CERTIFICATE_PEM) : null;
      if (!publicKeyPem) {
        return failed(this, "Configured external HSM public key file is unreadable", {});
      }

      const record = {
        ...createSignedAttestationRecord({
          providerId: env.MAATAA_HSM_PROVIDER_ID || this.id,
          providerType: this.providerType,
          challenge,
          evidenceBindingHash,
          publicKeyPem,
          certificatePem,
          signatureB64: env.MAATAA_HSM_SIGNATURE_B64,
          rawSummary: {
            certificate_present: Boolean(certificatePem),
            expected_signed_payload: createSignedPayload({ challenge, evidenceBindingHash }),
          },
        }),
        public_key_pem: publicKeyPem,
      };

      return finalizeRecord(this, record, challenge, replayCachePath);
    },
  };
}

export function summarizeAttestationResults(results) {
  const verified = results.filter((result) => result.status === "VERIFIED" && result.verification?.ok === true);
  return {
    verified,
    unavailable: results.filter((result) => result.status === ATTESTATION_UNAVAILABLE),
    failed: results.filter((result) => result.status === ATTESTATION_FAILED),
  };
}

function finalizeRecord(adapter, record, challenge, replayCachePath) {
  const verification = verifyAttestationRecord(record, challenge, { replayCachePath });
  if (!verification.ok) {
    return {
      provider_id: adapter.id,
      provider_type: adapter.providerType,
      status: ATTESTATION_FAILED,
      reason: "attestation record failed local verification",
      failures: verification.failures,
      record: sanitizeRecord(record),
      verification,
    };
  }
  return {
    provider_id: adapter.id,
    provider_type: adapter.providerType,
    status: "VERIFIED",
    reason: "attestation signature verified against nonce-bound challenge",
    record: sanitizeRecord(record),
    verification,
  };
}

function unavailable(adapter, reason, rawSummary) {
  return {
    provider_id: adapter.id,
    provider_type: adapter.providerType,
    status: ATTESTATION_UNAVAILABLE,
    reason,
    raw_summary: rawSummary,
    verification: { ok: false, failures: [reason] },
  };
}

function failed(adapter, reason, rawSummary) {
  return {
    provider_id: adapter.id,
    provider_type: adapter.providerType,
    status: ATTESTATION_FAILED,
    reason,
    raw_summary: rawSummary,
    verification: { ok: false, failures: [reason] },
  };
}

function sanitizeRecord(record) {
  const { public_key_pem: _publicKeyPem, signature_b64: signatureB64, ...safe } = record;
  return {
    ...safe,
    signature_sha256: signatureB64 ? sha256Text(signatureB64) : null,
  };
}

function runCommand(command, args, { timeoutMs = 5000 } = {}) {
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

function readFile(path) {
  try {
    if (!path || !existsSync(path)) {
      return "";
    }
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}
