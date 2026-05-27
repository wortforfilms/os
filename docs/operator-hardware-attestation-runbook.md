# Operator Hardware Attestation Runbook

This runbook prepares a real machine for Maataa OS hardware-root evidence capture.

It does not mark production GO. It only helps an operator discover whether TPM2, macOS Secure Enclave signed-key attestation, or an external HSM/YubiHSM provider can produce real evidence.

## Preflight

Run:

```bash
npm run hardware:env
```

The command returns:

- `PASS`: at least one provider environment is visible enough to attempt a signed quote or signature capture.
- `PARTIAL`: some provider signals exist, but required tools, devices, or environment variables are missing.
- `BLOCKED`: no provider environment is ready on this host.

`PASS` is not production GO. `npm run hardware:root` and `npm run govern:release` remain the release gates.

## Linux TPM2

Required host conditions:

- Linux host
- TPM 2.0 enabled in firmware
- `/dev/tpmrm0` or `/dev/tpm0` available
- `tpm2_quote` and `tpm2_getcap` available in `PATH`

Remediation:

1. Enable TPM 2.0 in BIOS or firmware.
2. Install `tpm2-tools`.
3. Verify:

```bash
ls -l /dev/tpmrm0 /dev/tpm0
tpm2_getcap properties-fixed
```

4. Generate a nonce-bound quote outside this repo using the operator-approved TPM procedure.
5. Export:

```bash
export MAATAA_TPM2_AK_PUBLIC_PEM=/secure/path/ak-public.pem
export MAATAA_TPM2_QUOTE_SIGNATURE_B64='base64-signature'
export MAATAA_TPM2_QUOTE_PATH=/secure/path/quote.bin
```

The adapter will verify the configured material. Device presence alone is never treated as attestation.

## macOS Secure Enclave

Required host conditions:

- macOS host
- `security` CLI available
- Secure Enclave, T2, or iBridge signal visible where the OS exposes it
- nonce-bound Secure Enclave key signature material

Remediation:

1. Confirm command availability:

```bash
security list-keychains
system_profiler SPiBridgeDataType
```

2. Generate or export a Secure Enclave-backed public key and signature for the Maataa signed payload using an operator-approved local tool.
3. Export:

```bash
export MAATAA_SE_PUBLIC_KEY_PEM=/secure/path/se-public.pem
export MAATAA_SE_SIGNATURE_B64='base64-signature'
```

Presence is only a signal. Full silicon attestation is not claimed unless the challenge signature verifies.

## External HSM / YubiHSM

Required host conditions:

- readable HSM public key PEM
- base64 signature over the Maataa signed payload
- optional certificate PEM

Export:

```bash
export MAATAA_HSM_PUBLIC_KEY_PEM=/secure/path/hsm-public.pem
export MAATAA_HSM_SIGNATURE_B64='base64-signature'
export MAATAA_HSM_CERTIFICATE_PEM=/secure/path/hsm-cert.pem
export MAATAA_HSM_PROVIDER_ID='factory-hsm-01'
```

The adapter verifies the signature locally. Environment variables alone do not create production evidence.

## Verification Sequence

Run:

```bash
npm run hardware:env
npm run hardware:attest
npm run hardware:root
npm run govern:release
```

Expected honest behavior:

- Missing provider material: `PARTIAL` or `BLOCKED`
- Invalid signature: `BLOCKED`
- Valid provider signature: hardware-root evidence may become `CAPTURED`
- Governed release still requires every other production gate to pass

## PHKD Rules

- No fake MMIO.
- No fake TPM.
- No fake Secure Enclave quote.
- No fake HSM claim.
- No production GO from preflight alone.
- Every remediation step must be operator-repeatable and locally verifiable.
