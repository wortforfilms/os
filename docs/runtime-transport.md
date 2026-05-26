# Runtime Transport

Maataa OS now has a local runtime status transport for the desktop product slice.

## States

- `LIVE`: Electron IPC bridge is responding with cursor-based heartbeat events.
- `DEGRADED`: Browser-only fallback is active. The UI is running, but no Electron IPC stream is present.
- `OFFLINE`: No event has been received yet.
- `BLOCKED`: A malformed event batch or invalid cursor was rejected.

## Guarantees

- No external network transport is used.
- The Electron bridge exposes `runtimeEventsSince(cursor)`.
- The browser fallback never claims live transport. It reports `DEGRADED`.
- Event batches are validated before the dashboard consumes them.

## Current Limits

This is not a public HTTP SSE endpoint. It is an Electron-safe local event cursor designed for the current Vite/Electron runtime. A future HTTP `/api/runtime/events` endpoint should remain blocked until a real server surface exists.
