# Hardware Root Of Trust Evidence

Captured: 2026-05-26T16:19:53.568Z
Status: PARTIAL
Production ready: false
PHKD verdict: BLOCKED
Evidence hash: e1cbd36cc3d1fd45f3c9f52487c5ca34f1f7ec368d202b13472ab769b0ce03e1
No fake claims: true

## Host Platform

- Platform: darwin
- Architecture: arm64
- OS release: 23.6.0

## Trust Sources

- macos-system-profiler-hardware (host-identity): CAPTURED_HASHED 89af1f62d17e0dad2f987e2adf296dc12aee8f6d13086e04f37944876390f6a5
- macos-ioreg-platform (machine-uuid-signal): CAPTURED_HASHED 22b4dd01cfdfd9e066f06c3db201bd5b4be6a4819ee4910c717c45a2ae3d8af8
- macos-boot-security-mode (boot-security-signal): CAPTURED_HASHED 83fb612043aa785d573f4d9ad5bae8ed63dc175f4c39f984d66c367f996f0d36

## Missing Sources

- macOS Secure Enclave attestation is not exposed to this process
- macos-cpu-identity: unavailable
- linux-tpm2-quote: TPM2 quote adapter is Linux-only
- macos-secure-enclave-signed-key: No macOS Secure Enclave or keychain presence signal was visible
- external-hsm-signature: External HSM/YubiHSM attestation material is not configured in MAATAA_HSM_PUBLIC_KEY_PEM and MAATAA_HSM_SIGNATURE_B64
- direct MMIO window 0xFE001000 is not safely accessible from this host process
- hardware-fused attestation quote is not available to this local Node.js capture process

## Blockers

- HARDWARE_ATTESTATION_QUOTE_MISSING: No TPM, Secure Enclave, HSM, or factory-fused attestation quote was exposed to this process.

## Attestation Providers

- linux-tpm2-quote (tpm2-quote): UNAVAILABLE - TPM2 quote adapter is Linux-only
- macos-secure-enclave-signed-key (secure-enclave-signed-key): UNAVAILABLE - No macOS Secure Enclave or keychain presence signal was visible
- external-hsm-signature (external-hsm): UNAVAILABLE - External HSM/YubiHSM attestation material is not configured in MAATAA_HSM_PUBLIC_KEY_PEM and MAATAA_HSM_SIGNATURE_B64

## Raw Command Summary

- system_profiler SPHardwareDataType: ok=true stdout=470B stderr=0B
- system_profiler SPiBridgeDataType: ok=true stdout=0B stderr=0B
- ioreg -rd1 -c IOPlatformExpertDevice: ok=true stdout=1840B stderr=0B
- csrutil status: ok=true stdout=45B stderr=0B
- sysctl -n machdep.cpu.brand_string: ok=false stdout=0B stderr=54B
