# Troubleshooting

This page covers common local preview and evidence issues.

## Electron Shows An Older Layout

1. Stop Electron.
2. Kill stale desktop processes.
3. Regenerate evidence.
4. Relaunch.

```bash
killall Electron
npm run evidence:generate
npm run electron:dev
```

## Tauri Or Vite Cannot Bind Localhost

This can happen in sandboxed shells. Confirm there is no stale server:

```bash
ps -Ao pid=,command= | rg "vite|tauri|electron"
```

If the port is already in use, stop the old process and retry.

## `tsup` Is Not Found

Package builds use `tsup`. Install workspace dependencies before package builds:

```bash
npm install
```

Then retry:

```bash
pnpm --filter @maataa/maataa-ui build
pnpm --filter @maataa/lipi-runtime build
```

If dependency installation is intentionally unavailable, keep the package build marked `BLOCKED`.

## Hardware Root Evidence Is Partial Or Blocked

That is expected on most development machines. Run:

```bash
npm run hardware:env
npm run hardware:root
```

Production remains blocked unless the evidence file reports a real captured trust source with no blockers.

## Governed Release Gate Does Not Promote

Check:

- `release/evidence/hardware-root-of-trust.json`
- `release/evidence/release-authority.json`
- `release/evidence/governed-production-gate.json`
- `release/evidence/blockers.json`

Do not edit these files manually to force GO. Fix the missing evidence source.

## QEMU Alpha Smoke Fails

Run:

```bash
bash scripts/smoke-alpha.sh
```

If the failure mentions generated AppleDouble files on an external volume, clean `._*` metadata files only after confirming they are sidecars, then rerun the smoke test.

## Lipi Runtime Is Blocked

The Lipi scaffold intentionally stays blocked for production because real hardware, release, rollback, and operator evidence is missing. Local tests can still pass:

```bash
npm run typecheck:lipi-runtime
npm run test:lipi
node packages/lipi-runtime/scripts/release/verify-lipi-release.mjs
```
