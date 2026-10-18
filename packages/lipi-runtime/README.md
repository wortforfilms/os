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

Build and verify commands require a bootstrapped workspace. Run `pnpm install` from the repository root before
expecting `tsup` or TypeScript package binaries to resolve. If `node_modules` is absent, a build failure is a local
bootstrap blocker, not a production readiness signal.

```bash
pnpm --filter @maataa/lipi-runtime typecheck
pnpm --filter @maataa/lipi-runtime build
pnpm --filter @maataa/lipi-runtime verify
npm run test:lipi
```

The release verifier resolves the package root from its own file path, so it can also be run from the repository root
or from `packages/lipi-runtime`:

```bash
node packages/lipi-runtime/scripts/release/verify-lipi-release.mjs
cd packages/lipi-runtime && node scripts/release/verify-lipi-release.mjs
```
