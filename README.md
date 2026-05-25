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

Not yet included:

- Real STM32 peripheral initialization
- Interrupt-driven drivers
- LittleFS flash persistence
- Executing WebAssembly capsules
- Capability enforcement and capsule signing
- CI and hardware validation matrix

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
- [Promoted UI modules](docs/MAATAA_OS_UI_MODULES.md)
