# Maataa OS

Maataa OS is an embedded Cortex-M operating-system prototype. The current
release target is a QEMU alpha: it boots under `qemu-system-arm`, initializes
virtual kernel subsystems, loads static capsule slots, runs a short scheduler
simulation, then preempts three demo tasks in round-robin order before exiting
through semihosting.

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
- Six-tick scheduler simulation, paced by the kernel clock
- Fixed-capacity round-robin and fixed-priority policies, with QEMU PendSV
  preemption demo
- Kernel monotonic clock: SysTick at 1 kHz from the 168 MHz core clock,
  cycle-precise reads, fed into `hemant-core::MonotonicTick`
  ([docs/kernel-clock.md](docs/kernel-clock.md); `./scripts/qemu-clock-test.sh`)
- Board selection: `board-qemu-f405` (default) or `board-f411`, with RCC set up
  through `stm32f4xx-hal`. Real hardware runs through `probe-rs`
  (`./scripts/run-hw.sh`); this has not yet been run on a board
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

Expected result: QEMU prints the boot report, runs six telemetry ticks with
nominal health, prints `task 1`, `task 2`, `task 3` in order, then exits cleanly.

## Release Smoke Test

```bash
./scripts/smoke-alpha.sh
```

The smoke test checks both board builds, verifies F411 has no semihosting
dependency, runs the host suite, validates the boot report and task order in
QEMU, runs the clock self-test, and prints one PASS/FAIL summary.

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
pnpm install
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
