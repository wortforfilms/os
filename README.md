# Maataa OS

Maataa OS is an embedded Cortex-M operating-system prototype. The current
release target is a QEMU alpha: it boots under `qemu-system-arm`, initializes
virtual kernel subsystems, loads static capsule slots, runs a short scheduler
simulation, reports health, and exits through semihosting.

## Status

Release: `v0.1.0-alpha.1`

This release is for local emulator validation. It is not a hardware-ready OS
release yet.

Working in this alpha:

- Cortex-M `no_std` boot path
- QEMU semihosting output
- Virtual driver registry for UART, GPIO, SPI, I2C, and power
- Virtual flash manifest
- Static capsule table with memory accounting
- Six-tick scheduler simulation
- Release size check
- Host unit tests for virtual kernel subsystems
- Vite/Electron sovereign runtime dashboard preview
- Local evidence generation and blocker reporting

Not yet included:

- Real STM32 peripheral initialization
- Interrupt-driven drivers
- LittleFS flash persistence
- Executing WebAssembly capsules
- Capability enforcement and capsule signing
- Next.js App Router production routes
- Prisma/libSQL application adapter
- Auth, billing, entitlement, and SSE API services
- Real local AI inference over model weights
- Hardware root of trust

## Quick Start

```bash
./scripts/run.sh
```

Expected result: QEMU prints the boot report, runs six scheduler ticks with
nominal health, then exits cleanly.

## Release Smoke Test

```bash
./scripts/smoke-alpha.sh
```

The smoke test runs `cargo check`, host unit tests, `cargo build --release`,
`scripts/sizecheck.sh`, and the QEMU launcher.

## Documentation

- [Build guide](doc/BUILD_GUIDE.md)
- [Architecture](doc/ARCHITECTURE.md)
- [System manifest](doc/SYSTEM_MANIFEST.md)
- [Roadmap](doc/ROADMAP.md)
- [Release notes](doc/RELEASE_NOTES.md)
- [Planned repository structure](docs/STRUCTURE.md)
- [Full scaffold](docs/SCAFFOLD.md)
- [Promoted UI modules](docs/MAATAA_OS_UI_MODULES.md)
- [Golden image deployment](docs/DEPLOYMENT.md)
- [IPC frame schema](docs/IPC_FRAME_SCHEMA.md)
- [MSAR frame matrix](docs/MSAR_FRAME_MATRIX.md)
- [Maataa UI package](packages/maataa-ui/README.md)
- [User guide](docs/user-guide.md)
- [Support](docs/support.md)
- [Troubleshooting](docs/troubleshooting.md)
- [FAQ](docs/faq.md)

## Desktop Preview

```bash
npm install
npm run evidence:generate
npm run electron:dev
```

The Electron shell renders the active SovereignDashboard from
`packages/maataa-ui`. Tauri remains available through `npm run tauri:dev`.

## Product Evidence

```bash
npm run typecheck
npm run test
npm run build
npm run evidence:generate
npm run status:matrix
```

Generated evidence:

- `COMPLETION_STATUS_MATRIX.json`
- `COMPLETION_STATUS_MATRIX.md`
- `release/evidence/latest.json`
- `release/evidence/blockers.json`
- `release/evidence/commands-run.md`
