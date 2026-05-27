# Aam Jantaa Launch Strategy - Phase 0.5

Maataa OS will not claim production readiness in this phase.

The Phase 0.5 launch track prepares the public-facing Aam Jantaa interface for local review while keeping the governed release state honest:

- `productionReady: false`
- `phkdVerdict: BLOCKED`
- `finalStatus: GOVERNED_PRODUCTION_NO_GO`

## User Flow

1. Home Frame
2. Language Select
3. Aam Jantaa Dashboard
4. Feature Entry Cards
5. Runtime Health
6. Evidence / Blocked Reason View
7. Rollback / Offline Fallback View

## Languages

- Hindi
- Haryanvi
- Punjabi

All labels are staged for local review. Haryanvi and Punjabi language surfaces remain `PREVIEW` until community validation is complete.

## Main Modules

| Module | Status | Offline | Honest Reason |
| --- | --- | --- | --- |
| Digital Gurukul | PREVIEW | yes | Frames exist; real content mapping and learning ledger evidence remain open. |
| Radio Vaigyaaniq | BLOCKED | yes | Live audio IPC and verified edge broadcast hardware are not proven. |
| Local Search | READY | yes | Local search and command palette are implemented for staged product scope. |
| Runtime Health | DEGRADED | yes | Runtime status is visible while hardware trust remains blocked. |
| Lipi Learning | PREVIEW | yes | Script assets exist; public learning UI remains staged. |
| Community Broadcast | BLOCKED | no | Release signer and operator quorum are not captured. |

## Governance Blockers

The interface must show the user why production is blocked:

- hardware-root attestation is not `CAPTURED`
- release signer verification is not `VERIFIED`
- operator quorum is not `VERIFIED`
- rollback drill evidence is not captured

## Launch Evidence

The deterministic local launch evidence is stored in:

- `data/language-interface-matrix.json`
- `apps/system/aam-jantaa-interface.ts`
- `release/evidence/launch-readiness-matrix.json`

## PHKD Boundary

No fake hardware proof, fake operator signatures, fake release authority, or fake GO state is allowed. The public interface may be staged, but the release status remains `GOVERNED_PRODUCTION_NO_GO` until real evidence clears every gate.
