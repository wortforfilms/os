# Maataa OS v0.1.0-alpha.2

## Release type

Kernel alpha for QEMU (`netduinoplus2`) and the NUCLEO-F411RE board. Every
feature below passed the QEMU smoke test (13/13) and CI; the "Board" column
says what was also run on a NUCLEO-F411RE.

## New since alpha.1

| Feature | Board | Docs |
| --- | --- | --- |
| Preemptive scheduler, MPU-isolated unprivileged tasks, syscalls, IPC | yes | README |
| Host channel over USART2 (`maataa-link`) | yes | docs/host-channel.md |
| Signed capsules (ed25519) and per-task capability masks | yes | docs/capsules.md |
| WebAssembly capsules, one task each, schedule and version from a signed manifest section | yes (tasks 7 and 8) | docs/wasm-capsules.md |
| Run-time capsule install over the host channel (flash sector 5, task 9) | not yet | docs/capsules.md |
| Persistent store: power-loss safe, sealed with ChaCha20-Poly1305 under a chip-bound key, migration from the unsealed format | yes | docs/persistence.md |
| Rollback counter in OTP (feature `otp-rollback`, off by default) | no, on purpose: OTP writes are permanent | docs/persistence.md |
| Watchdog (IWDG), reset cause and crash record | yes | docs/watchdog.md |
| Release build with release keys (`scripts/release.sh`) | built; flash it yourself | docs/release.md |

## Flash layout (F411)

| Sectors | Use |
| --- | --- |
| 0–4 (128 KiB) | kernel |
| 5 (128 KiB) | run-time capsule area |
| 6–7 (2 × 128 KiB) | persistent store |

## Upgrading a board from alpha.1 or a development build

- A development build (the default) opens the store a development build
  sealed, and seals an alpha.1 (unsealed) store on its first boot.
- A release build (`scripts/release.sh`) uses another store key. It refuses
  a store sealed with the development key (`sealed with a different key`)
  and leaves it untouched. Erase sectors 6–7 to start a fresh store: the old
  values are lost.

## Validation

```bash
./scripts/smoke-alpha.sh      # 13 checks, QEMU
./scripts/sizecheck.sh        # kernel within 128 KiB
```

CI also runs `cargo fmt --check` and clippy with `-D warnings` for the host
crates and six kernel builds.

## Known limits

- One run-time capsule at a time; it starts at the next boot.
- The store's rollback counter is opt-in and has not run on a board.
- Records cut off the end of the store's newest bank are not detected.
- The development keys are public. They give integrity, not secrecy; a
  release build with read-out protection is needed for secrecy.

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
