# Getting Started

Maataa-OS currently runs as a Vite React cockpit with Tauri and Electron shells.

```bash
npm install
npm run evidence:generate
npm run typecheck
npm run build
npm run electron:dev
```

The product is preview-verified for the SovereignDashboard and local evidence
matrix. Auth, billing, database-backed routes, and SSE APIs are blocked until
the runtime moves to an application server or equivalent local API host.
