# Governed Production Gate

Maataa OS cannot enter `GOVERNED_PRODUCTION_GO` through declarations alone.

The governed production gate is a deterministic release authority that evaluates:

- `COMPLETION_STATUS_MATRIX.json`
- `release/reports/PRODUCTION_HARDENING_MATRIX.json`
- `release/evidence/hardware-root-of-trust.json`

It writes:

- `release/evidence/governed-production-gate.json`
- `release/evidence/governed-production-gate.md`

## Hardware Root Of Trust Capture

Run:

```bash
npm run hardware:root
```

This command captures host trust signals that the current machine can truly expose. It may hash local host identity, CPU identity, TPM device presence, Secure Enclave system signals, boot security mode, and machine UUID signals where available.

It does not fabricate direct MMIO evidence. The script records MMIO as missing unless it can be safely and truly accessed by the host process.

For production attestation providers, see `docs/hardware-attestation.md`. TPM2, Secure Enclave, or HSM evidence only counts when a nonce-bound quote or signature verifies locally.

Generated files:

- `release/evidence/hardware-root-of-trust.json`
- `release/evidence/hardware-root-of-trust.md`

Required JSON fields:

```json
{
  "schema": "maataa.hardware.root-of-trust.capture.v1",
  "status": "CAPTURED",
  "production_ready": true,
  "captured_at": "2026-05-26T00:00:00.000Z",
  "host_platform": {
    "platform": "darwin",
    "arch": "arm64",
    "os_type": "Darwin",
    "os_release": "25.0.0"
  },
  "trust_sources": [],
  "missing_sources": [],
  "evidence_hash": "sha256",
  "phkd_verdict": "PASS",
  "blockers": [],
  "raw_command_summary": [],
  "no_fake_claims": true
}
```

## Status Rules

- `CAPTURED`: real hardware-root evidence is present, self-hashed, has non-empty `trust_sources`, has zero blockers, and sets `no_fake_claims=true`.
- `PARTIAL`: local host signals exist, but a required physical attestation source is missing.
- `BLOCKED`: no usable trust source was captured, or capture cannot establish a meaningful local trust root.

Only `CAPTURED` can pass the governed production gate. `PARTIAL` and `BLOCKED` are honest outputs and must keep the release in `GOVERNED_PRODUCTION_NO_GO`.

## Release Gate

Run:

```bash
npm run govern:release
```

The gate rejects hardware evidence unless:

- `status` is `CAPTURED`
- `production_ready` is `true`
- `evidence_hash` exists and matches the artifact payload
- `no_fake_claims` is `true`
- `trust_sources` is non-empty
- `blockers` is empty
- `phkd_verdict` is `PASS`

The command exits nonzero while production is blocked. This is intentional and preserves the boundary between implemented software and verified physical deployment.
