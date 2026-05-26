# Architecture

The current runtime has four active layers:

- Rust QEMU alpha kernel and fixed binary frame contracts.
- Vite React cockpit rendered by Tauri/Electron.
- `packages/maataa-ui` component and dashboard surfaces.
- Local evidence reports under `release/`.

The requested Next.js App Router and Prisma/libSQL layer is not active in this
repository. It is tracked as `BLOCKED` in `COMPLETION_STATUS_MATRIX.json`.
