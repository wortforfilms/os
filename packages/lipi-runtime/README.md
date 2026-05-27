# @maataa/lipi-runtime

Lipi Runtime is the governed scaffold for the Maataa / Vaigyaaniq script civilization layer.

It carries deterministic local records for the Phase 0 Amirpur field-test cluster:

- a 426-slot script registry matrix
- character anchor and token scaffolds
- script lineage graph edges
- phonetic and transliteration maps
- Digital Gurukul learning paths
- local search helpers
- PHKD governance evidence

## PHKD Status

- `PRODUCTION_READY=false`
- `PHKD_VERDICT=BLOCKED`
- `FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO`

The 426 registry is a structured local scaffold, not a scientific or historical certification claim. Hardware-root attestation, operator quorum, signed release authority, and rollback drill evidence are still required before any production GO language is allowed.

## Verification

```bash
pnpm --filter @maataa/lipi-runtime typecheck
npm run test:lipi
node packages/lipi-runtime/scripts/release/verify-lipi-release.mjs
```
