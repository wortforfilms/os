# API

Current Vite runtime does not expose production API routes.

Requested APIs:

- `POST /api/telemetry/events` is `BLOCKED`.
- `GET /api/admin/telemetry/recent` is `BLOCKED`.
- `/api/runtime/events` SSE is `BLOCKED`.

Loopback telemetry pressure scripts exist under `scripts/telemetry/` and
`tests/integration/`.
