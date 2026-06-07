# Governed Domains Registry

The governed domains registry is the local operator surface for domain, route,
runtime, DNS, and evidence state. It is intentionally not a DNS monitor and does
not claim public deployment health.

## Routes

- `/domains` renders the governed registry table.
- `/domains/status` renders blocker-focused DNS and runtime status.
- `/domains/runtime` renders domain-to-runtime mapping.

Each route is `PREVIEW_VERIFIED` only because the local route and component
artifact exist in this repository. That status does not mean DNS uptime, public
traffic, or production release readiness.

## Source

The source registry is `data/domain-registry.json`. Every domain record includes:

- `domain`
- `surface`
- `route`
- `runtime`
- `dnsState`
- `runtimeState`
- `evidence`
- `blocker`

Valid DNS states are `VERIFIED`, `UNKNOWN`, and `BLOCKED`. The registry must not
emit `LIVE` without a real resolver-backed evidence pipeline. Current unknown
DNS states remain `UNKNOWN` and contribute blockers.

Valid runtime states are `PREVIEW_VERIFIED`, `STAGED`, `UNKNOWN`, and `BLOCKED`.
Missing routes are searchable but not navigable.

## Evidence

`npm run evidence:generate` writes `release/evidence/domain-registry.json` and
adds domain blockers into the completion status matrix. The evidence file keeps:

- `productionReady: false`
- `finalStatus: CONTROLLED_NO_GO`
- `phkdVerdict: BLOCKED`
- `noFakeDnsUptime: true`
- `noFakeLiveDeployment: true`
- `noFakeProductionReadiness: true`

Final release status remains `CONTROLLED_NO_GO` until global gates pass with real
DNS, runtime, hardware trust, and release-authority evidence.
