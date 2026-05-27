# Maataa OS User Guide

Maataa OS is currently a governed preview runtime. It is useful for local exploration, runtime evidence review, Aam Jantaa interface testing, Lipi learning scaffold checks, and desktop dashboard validation.

It is not production ready. The current governed status is:

```txt
PRODUCTION_READY=false
FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO
```

## What You Can Use Today

- Sovereign runtime dashboard preview
- Aam Jantaa interface frames
- Hindi, Haryanvi, and Punjabi public interface modes
- Lipi Runtime scaffold with a deterministic 426-slot registry
- Runtime Observatory evidence views
- Local search and runtime status surfaces
- Electron desktop preview
- QEMU alpha kernel smoke tests

## What Is Blocked

- Production hardware release
- Real hardware-root attestation
- Operator quorum release approval
- Signed release authority promotion
- Rollback drill certification
- Scientific certification claims
- Public production deployment

## Start The Desktop Preview

```bash
npm install
npm run evidence:generate
npm run electron:dev
```

If the desktop shell opens but looks stale, stop running Electron processes and launch again:

```bash
killall Electron
npm run electron:dev
```

## Run Local Verification

```bash
npm run typecheck
npm run test
npm run status:matrix
npm run audit:phkd
```

## Read The Status

Use these files as the source of truth:

- `COMPLETION_STATUS_MATRIX.md`
- `release/evidence/latest.json`
- `release/evidence/blockers.json`
- `release/evidence/governed-production-gate.json`
- `release/evidence/hardware-root-of-trust.json`

## Honest Badge Meanings

- `READY`: usable in the current local preview scope
- `PREVIEW`: visible and testable, but not production
- `BLOCKED`: cannot proceed until evidence is attached
- `OFFLINE`: local-only mode is available
- `VERIFYING`: checks are running or evidence is incomplete
- `DEGRADED`: fallback mode is active

## Safety Rule

Do not treat any view, package, tarball, or evidence file as production GO unless the governed production gate says so.
