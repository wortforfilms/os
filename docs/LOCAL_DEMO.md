# MAATAA Local Demo

This runbook is for a local functional preview only. It does not claim production readiness, live traffic, payment readiness, or deployed uptime.

## Status

- Final status: `CONTROLLED_NO_GO`
- Production readiness: `false`
- PHKD verdict: `BLOCKED`
- Metrics mode: local seeded demo events, not live analytics
- Payments: disabled; no payment flow is exercised or claimed

## Surfaces

| Surface | Local target | Verification |
| --- | --- | --- |
| Web | `http://127.0.0.1:1420/` | HTTP route is opened locally by the evidence capture script. |
| Electron | `MAATAA_ELECTRON_URL=http://127.0.0.1:1420/` | Main process load contract is checked against the local web target. |
| Tauri | `src-tauri/tauri.conf.json` `build.devUrl` | Tauri dev config is checked against the local web target. |

The automated evidence script does not claim a GUI display was launched. Operators can run GUI shells manually after the web route is ready:

```sh
npm run dev -- --port 1420 --strictPort
npm run electron:dev
env PATH=$HOME/.cargo/bin:$PATH npm run tauri:dev
```

## Capture Evidence

Run:

```sh
npm run local-demo:evidence
```

This writes evidence under `release/evidence/local-demo/`:

- `analytics-seed.json`
- `analytics-events.jsonl`
- `web-route.json`
- `shell-load-contracts.json`
- `summary.json`
- `summary.md`
- `web-server.log` when the script starts Vite itself

The capture flow starts or reuses a loopback Vite server, opens the web route locally, verifies Electron/Tauri local-load contracts, and records blockers honestly. It keeps `productionReady=false` and `finalStatus=CONTROLLED_NO_GO`.

## Verification Commands

Run the normal project gates after capturing evidence:

```sh
npm run typecheck
npm run test
npm run build
npm run status:matrix
env PATH=$HOME/.cargo/bin:$PATH npm run smoke
git diff --check
```

If a GUI shell cannot be launched in the current host/session, do not mark it as live. Keep the evidence as `PREVIEW_VERIFIED` for local load contract verification or `BLOCKED` with the host error.
