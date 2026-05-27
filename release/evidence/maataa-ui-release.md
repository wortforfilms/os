# @maataa/maataa-ui Governed Release Candidate

Package: `@maataa/maataa-ui`

Phase: `MAATAA_UI_RELEASE_CANDIDATE`

Final status: `GOVERNED_PRODUCTION_NO_GO`

Production ready: `false`

PHKD verdict: `BLOCKED`

## Preserved Context

- Maataa sovereign runtime
- Vaigyaaniq umbrella
- TLP production/runtime stack
- Aam Jantaa Interface
- Lipi 426-script database matrix
- Runtime Observatory
- Status Matrix
- Evidence-first governance
- Offline-first public interface
- Hindi, Haryanvi, Punjabi language modes
- Radio Vaigyaaniq
- Digital Gurukul
- Local Search
- Runtime Health

## Active Blockers

- `hardware_root_attestation_missing`
- `operator_quorum_unverified`
- `signed_release_authority_unverified`
- `rollback_drill_not_verified`
- package build blocked because `tsup` is not installed in the current workspace

No production GO is claimed.

## Command Evidence

| Command | Result |
| --- | --- |
| `pnpm --filter @maataa/maataa-ui typecheck` | PASS |
| `pnpm --filter @maataa/maataa-ui build` | BLOCKED: `tsup` command not found |
| `pnpm --filter @maataa/maataa-ui pack` | PASS |
| `node scripts/release/verify-maataa-ui-release.mjs` | PASS |
| `pnpm test` | PASS |

Tarball: `/Volumes/LaCie/pprm/tlps.in/maataa-os/maataa-maataa-ui-0.1.0-alpha.1.tgz`
