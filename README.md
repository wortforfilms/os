# Maataa OS

Maataa OS is a Rust `no_std` operating-system kernel for Cortex-M
microcontrollers. It boots in QEMU (`netduinoplus2`, STM32F405) and on a
NUCLEO-F411RE board.

This repository holds only the kernel. The desktop shell, UI packages,
evidence tooling and other JS/TS work live in the separate `maataa-apps`
repository, which does not build or test this kernel.

## Status

Release: `v0.1.0-alpha.1`

Working:

- Cortex-M boot path, QEMU semihosting output, RTT on hardware
- Preemptive scheduler (PendSV), round-robin and fixed-priority policies
- MPU-isolated unprivileged tasks and SVC system calls
- Mailbox IPC, mutexes and semaphores
- USART2 TX/RX with a 256-byte RX FIFO and blocking wake on receive
- Kernel monotonic clock: SysTick at 1 kHz, cycle-precise reads, fed into
  `hemant-core::MonotonicTick` ([docs/kernel-clock.md](docs/kernel-clock.md))
- Board selection: `board-qemu-f405` (default) or `board-f411`, RCC set up
  through `stm32f4xx-hal`. Verified on a NUCLEO-F411RE: demo, UART echo and
  RX wake.
- Static capsule table, virtual flash manifest, release size check

Not yet:

- Executing WebAssembly capsules
- Capability enforcement and capsule signing
- LittleFS flash persistence
- UART host channel

## Requirements

- Rust (stable; targets and `rust-src` come from `rust-toolchain.toml`)
- `qemu-system-arm`, `arm-none-eabi-size` (binutils), `ripgrep`
- For hardware: `probe-rs`

## Quick start

```bash
./scripts/run.sh            # boot in QEMU
./scripts/smoke-alpha.sh    # release gate: 9 checks, one PASS/FAIL line
./scripts/test-host.sh      # host unit tests
./scripts/run-hw.sh         # flash and run on NUCLEO-F411RE
```

On macOS the `.command` files in the repository root run the same steps by
double-click.

## Documentation

- [Build guide](doc/BUILD_GUIDE.md)
- [Architecture](doc/ARCHITECTURE.md)
- [System manifest](doc/SYSTEM_MANIFEST.md)
- [Roadmap](doc/ROADMAP.md)
- [Release notes](doc/RELEASE_NOTES.md)
- [Kernel clock](docs/kernel-clock.md)
- [Kernel IPC](docs/kernel-ipc.md)
- [Kernel MPU](docs/kernel-mpu.md)
- [Scheduler](docs/engineering/SCHEDULER.md)
- [IPC frame schema](docs/IPC_FRAME_SCHEMA.md)
- [MSAR frame matrix](docs/MSAR_FRAME_MATRIX.md)
