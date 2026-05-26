# Completion Status Matrix

Generated: 2026-05-26T08:04:07.703Z
Commit: eaac30d
Final status: CONTROLLED_NO_GO
Production ready: false
PHKD verdict: BLOCKED

## Routes

| Route | State | Evidence |
| --- | --- | --- |
| / | PREVIEW_VERIFIED | Vite root renders SovereignDashboard in Electron/Tauri-compatible shell. |
| /dashboard | STAGED | Dashboard component exists but router route is not implemented. |
| /runtime-observatory | STAGED | Observatory panels exist inside maataa-ui; route is not implemented. |
| /domains | BLOCKED | No domains route or database-backed domain model is wired. |
| /search | PREVIEW_VERIFIED | Unified local search route is wired with type/status filters, empty state, and blocked route badges. |
| /admin | PREVIEW_VERIFIED | Protected admin shell is wired with Admin-only role guard and fail-closed access. |
| /auth/login | PREVIEW_VERIFIED | Login route authenticates seed users through the local auth bridge and persists sessions. |
| /auth/signup | PREVIEW_VERIFIED | Signup route creates local Viewer accounts and opens a persisted session. |
| /settings | STAGED | Theme/runtime packages exist; route is not implemented. |
| /docs | PREVIEW_VERIFIED | Docs exist in repository; in-app docs route is not implemented. |

## Features

| Feature | State | Evidence |
| --- | --- | --- |
| cinematic-homepage | PREVIEW_VERIFIED | SovereignDashboard now has cinematic header and ecosystem schematic. |
| sovereign-dashboard | PREVIEW_VERIFIED | Active Vite/Electron entrypoint renders SovereignDashboard. |
| ecosystem-schematic | PREVIEW_VERIFIED | Dashboard includes apps/crates/packages, offline cores, quadrants, archive flow. |
| runtime-observatory | STAGED | Panels exist, but route/live orchestration is not complete. |
| auth-and-roles | PREVIEW_VERIFIED | Electron auth bridge stores users, sessions, and audit logs in local SQLite; browser fallback is preview-only. |
| offline-local-db | PREVIEW_VERIFIED | SQLite product runtime migration and Electron auth store are active for the auth slice. |
| telemetry | PREVIEW_VERIFIED | Telemetry pressure and chaos reports exist for loopback frames. |
| sse-live-status | PREVIEW_VERIFIED | Electron-safe runtime event cursor emits local heartbeat events; browser fallback reports DEGRADED instead of fake live. |
| search | PREVIEW_VERIFIED | Unified search index and Ctrl/Cmd+K command palette are wired to local product matrix, docs, states, blockers, and repo surfaces. |
| billing-entitlements | BLOCKED | No local billing simulator or entitlement checks are implemented. |
| admin-analytics | BLOCKED | No admin analytics route or persisted analytics events exist. |
| evidence-matrix | PREVIEW_VERIFIED | Production hardening matrix and evidence reports are generated locally. |
| release-governance | PREVIEW_VERIFIED | Golden image verification reads hardening matrix and refuses false PASS. |
| desktop-electron | PREVIEW_VERIFIED | Electron shell launches local Vite UI with loopback-only request gate. |
| ci | PREVIEW_VERIFIED | GitHub Actions verify workflow added for local gates. |

## Blockers

- /domains: No domains route or database-backed domain model is wired.
- billing-entitlements: No local billing simulator or entitlement checks are implemented.
- admin-analytics: No admin analytics route or persisted analytics events exist.
- MSAR: Hardware root of trust: Synthetic identity exists; HSM/TPM secure boot loop is not integrated.
- RadioVaigyaaniq: NCR appliance cluster config: No Delhi/Noida/Gurugram autonomous deployment matrix is present.

