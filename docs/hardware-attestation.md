# Hardware Attestation Adapter Layer

The hardware attestation layer separates host inventory from production trust.

Host inventory can produce `PARTIAL` evidence. Production trust requires a verified provider quote or signature bound to a fresh nonce and the evidence hash.

## Commands

```bash
npm run hardware:attest
npm run hardware:root
npm run govern:release
```

`npm run hardware:attest` writes:

- `release/evidence/hardware-attestation.json`
- `release/evidence/hardware-attestation.md`

`npm run hardware:root` folds verified attestation results into:

- `release/evidence/hardware-root-of-trust.json`
- `release/evidence/hardware-root-of-trust.md`

## Remote Verifier Contract

Each provider must satisfy:

- nonce challenge
- provider quote or signature capture
- local public key or certificate chain reference
- signature verification over the nonce-bound payload
- replay protection
- evidence hash binding

The signed payload is:

```json
{
  "schema": "maataa.hardware.attestation.signed-payload.v1",
  "nonce": "fresh challenge nonce",
  "challenge_hash": "sha256 challenge hash",
  "evidence_binding_hash": "sha256 evidence hash"
}
```

## Providers

### Linux TPM2 Quote

The TPM2 adapter is Linux-only. It does not claim TPM evidence from device path presence alone.

Configured inputs:

- `MAATAA_TPM2_AK_PUBLIC_PEM`
- `MAATAA_TPM2_QUOTE_SIGNATURE_B64`
- `MAATAA_TPM2_QUOTE_PATH`

If those are absent, the adapter reports `UNAVAILABLE`.

### macOS Secure Enclave

The macOS adapter records Secure Enclave or keychain presence only as a signal. It does not claim full silicon attestation unless a nonce-bound Secure Enclave key signature is provided.

Configured inputs:

- `MAATAA_SE_PUBLIC_KEY_PEM`
- `MAATAA_SE_SIGNATURE_B64`

If those are absent, the adapter reports `UNAVAILABLE` even if platform presence is detected.

### External HSM / YubiHSM

The external HSM adapter verifies a locally supplied HSM public key and nonce-bound signature.

Configured inputs:

- `MAATAA_HSM_PUBLIC_KEY_PEM`
- `MAATAA_HSM_SIGNATURE_B64`
- optional `MAATAA_HSM_CERTIFICATE_PEM`
- optional `MAATAA_HSM_PROVIDER_ID`

## PHKD Gate Behavior

- No fake MMIO fallback exists.
- No fake TPM fallback exists.
- No fake Secure Enclave quote exists.
- Provider absence keeps evidence `PARTIAL` or `BLOCKED`.
- `GOVERNED_PRODUCTION_GO` requires `hardware-root-of-trust.json` to be `CAPTURED`, self-hashed, and blocker-free.
