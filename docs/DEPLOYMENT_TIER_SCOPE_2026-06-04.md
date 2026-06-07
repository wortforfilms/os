# Deployment Tier Scope Decision — Hardware Attestation Boundary

- **Date:** 2026-06-04
- **Commit:** 7804c14
- **Status:** DECISION RECORDED — production gate UNCHANGED
- **PHKD verdict at time of writing:** `CONTROLLED_NO_GO` / `GOVERNED_PRODUCTION_NO_GO`
- **Author intent:** expose the hardware-trust boundary explicitly. This document does **not** flip any status and does **not** weaken the production gate. It defines tiers so the system can ship honestly at the assurance level it can actually evidence today, while keeping the hardware-attested production claim blocked until real silicon evidence exists.

## Why this exists

A request was made to move the federation from `NO_GO` to `GO`. Reading the gate
code (`scripts/governed-production-gate.mjs`, `scripts/release-authority/contract.mjs`)
confirms the gate is correctly **fail-closed**: a `GO` requires valid hardware
root-of-trust evidence, and even a `RELEASE_CANDIDATE` requires a hardware-backed
(`tpm2-release-signer` / `external-hsm-release-signer`) signature. Neither can be
produced in a software-only session without **faking hardware trust**, which the
PHKD directive explicitly forbids ("Never fake: hardware trust, attestation",
"Never fake signatures", "FAIL CLOSED").

Rather than fake the GO, we make the boundary a first-class, visible governance
artifact. This is the directive-compliant move: *document it, expose it, never
hide it.*

## The two genuine blockers (hard stops in this environment)

1. **Hardware root of trust — `HARDWARE_ATTESTATION_QUOTE_MISSING`.**
   `release/evidence/hardware-root-of-trust.json` is `PARTIAL`. macOS hardware
   profile, IOReg identity, and SIP status are captured as SHA-256 digests, but
   no TPM2 quote, Secure Enclave attestation, HSM signature, or factory-fused
   quote is exposable to the Node capture process. Required by
   `validateHardwareRootEvidence` (zero blockers + `phkd_verdict:PASS`).

2. **Release authority signer — not verified.**
   `verifyReleaseSigner` only accepts a real `crypto.verify` signature from a
   `tpm2-release-signer` or `external-hsm-release-signer`, keyed on env material
   (`MAATAA_RELEASE_TPM2_*` / `MAATAA_RELEASE_HSM_*`). No such hardware-backed
   material is configured. Generating a software keypair and presenting it under
   a TPM2/HSM provider type would be faking hardware trust — out of scope.

Operator approval quorum (2/2) is a separate, software-keyable governance step,
but it cannot by itself unblock release authority while the hardware signer is
blocked, so elevating it in isolation changes nothing.

## Tier model

### Tier A — `SOFTWARE_SOVEREIGN_PREVIEW`
- **Hardware attestation:** NOT claimed. Explicitly absent.
- **Release signing:** NOT hardware-backed. Explicitly absent.
- **Honest claim set:** local-first, offline-capable, runtime-federated software
  preview. No "sovereign", no "hardware-rooted", no "production GO" language.
- **Gate inputs that must still pass:** completion matrix free of *route/feature*
  blockers, hardening matrix PASS, zero fabricated metrics presented as real in
  live surfaces, CI integrity, rollbackability.
- **Maximum permitted status label:** `SOFTWARE_SOVEREIGN_PREVIEW` — never `GO`.

### Tier B — `HARDWARE_ATTESTED_PRODUCTION`
- **Hardware attestation:** REQUIRED — real TPM2 / Secure Enclave / HSM /
  fused quote, validated by `validateHardwareRootEvidence`.
- **Release signing:** REQUIRED — verified hardware-backed signer + operator
  approval quorum, validated by `verifyReleaseAuthority`.
- **Status today:** `GOVERNED_PRODUCTION_NO_GO`. Remains blocked until the two
  hard stops above are cleared on real hardware. This is the only tier that may
  ever carry a `GO`.

## What this decision explicitly does NOT do

- Does not modify `scripts/governed-production-gate.mjs` or the release-authority
  contract.
- Does not set `finalStatus` or `status` to `GO`.
- Does not generate, stub, or relabel any signing key.
- Does not delete the recorded `BLOCKED` fabrication claims (deleting them would
  hide the fabrication problem).

## Path to a real Tier B GO (for whoever has the hardware)

1. Run `npm run hardware:attest` / `hardware:root` on a host that exposes a TPM2
   quote, Secure Enclave attestation, or HSM signature; confirm
   `hardware-root-of-trust.json` reaches `CAPTURED` with zero blockers.
2. Configure `MAATAA_RELEASE_TPM2_*` (or `MAATAA_RELEASE_HSM_*`) with genuine
   hardware-backed key + signature over the manifest payload; run
   `npm run operator:enroll` for two real operators and `operator:approve` to
   reach quorum.
3. Rebuild surfaces so no fabricated metric ships (purge stale Electron bundle
   `index-EOM38Ta2.js` via a clean `npm run electron:build`).
4. `npm run evidence:generate` then `node scripts/governed-production-gate.mjs`
   and confirm `GOVERNED_STATUS=GOVERNED_PRODUCTION_GO` is produced by the gate
   itself — never by hand-editing evidence.

Until step 4 emits GO on its own, the honest status is and remains
`GOVERNED_PRODUCTION_NO_GO`.
