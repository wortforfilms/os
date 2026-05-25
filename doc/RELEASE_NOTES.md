# Maataa OS v0.1.0-alpha.1

## Release Type

QEMU alpha prototype.

## What Works

- Boots as a Cortex-M `no_std` binary in QEMU.
- Emits semihosting boot logs.
- Initializes virtual drivers for UART, GPIO, SPI, I2C, and power.
- Mounts a virtual flash storage manager and records a system manifest.
- Loads two static capsule slots and tracks capsule memory usage.
- Runs a deterministic six-tick scheduler simulation.
- Reports nominal system health.
- Exits cleanly through semihosting.
- Provides host unit tests for virtual drivers, storage, and capsules.

## Validation Commands

```bash
cargo check
./scripts/test-host.sh
cargo build --release
./scripts/sizecheck.sh
./scripts/run.sh
```

## Known Limits

- The driver layer is simulated.
- The capsule layer stores static images but does not execute WASM.
- Storage is an in-memory manifest, not LittleFS.
- Hardware flashing is still experimental and not part of this release gate.
- The project directory is not currently a Git repository.

## Release Gate

This alpha is releasable when `./scripts/smoke-alpha.sh` passes on a clean
workspace with QEMU and the ARM binutils installed.
