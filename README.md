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
- USART2 TX/RX with a 256-byte RX FIFO and blocking wake on receive, on
  both QEMU and the F411
- Host channel over USART2: COBS-framed, CRC-checked PING, STATUS,
  TELEMETRY and INFO requests, served by an unprivileged task; host tool
  `maataa-link` ([docs/host-channel.md](docs/host-channel.md))
- Kernel monotonic clock: SysTick at 1 kHz, cycle-precise reads, fed into
  `hemant-core::MonotonicTick` ([docs/kernel-clock.md](docs/kernel-clock.md))
- Board selection: `board-qemu-f405` (default) or `board-f411`, RCC set up
  through `stm32f4xx-hal`. Verified on a NUCLEO-F411RE: demo, UART echo and
  RX wake. Host channel selftest passed in QEMU and on the board.
- Signed capsules (MCAP, ed25519) and per-task capability masks: every
  supervisor call is checked against the calling task's mask, and the host
  channel task's mask comes from its signed manifest
  ([docs/capsules.md](docs/capsules.md))
- WebAssembly capsules: every verified capsule whose payload is WebAssembly
  runs in a task of its own (tasks 7 and 8: telemetry and heartbeat), in a
  small `no_std` interpreter (`crates/maataa-wasm`: i32 subset with a 4 KiB
  host-bounded linear memory, fuel-limited; checked against wasmi). Its
  imports (log, strings, sleep, LED, persistent store) are supervisor calls,
  so its manifest's capabilities bind it, and its schedule comes from a
  signed `maataa` section in the module
  ([docs/wasm-capsules.md](docs/wasm-capsules.md))
- Run-time capsule install over the host channel: a signed WebAssembly
  capsule goes into flash sector 5 and runs as task 9 from the next boot.
  The kernel checks signature, name, module and version (no downgrades), and
  a refused or interrupted install keeps the installed capsule
  ([docs/capsules.md](docs/capsules.md#installing-a-capsule-at-run-time))
- Watchdog (F411 IWDG, fed by the scheduler tick), reset cause, and a crash
  record that survives the reset; each boot reports both and saves them to
  persistent key 1 ([docs/watchdog.md](docs/watchdog.md))
- Persistent key-value store on flash sectors 6–7 (F411) or a host file
  (QEMU): power-loss safe, two-bank compaction, boot count; every value
  sealed with ChaCha20-Poly1305 under a key bound to the chip's unique id;
  tasks and the host channel use it through syscalls 15/16
  ([docs/persistence.md](docs/persistence.md))
- Static capsule table, virtual flash manifest, release size check

Not yet:

- Rollback protection for the store (needs a counter in OTP)
- More than one run-time capsule at a time, and starting one without a reboot

## Requirements

- Rust (stable; targets and `rust-src` come from `rust-toolchain.toml`)
- `qemu-system-arm`, `arm-none-eabi-size` (binutils), `ripgrep`
- For hardware: `probe-rs`

## Quick start

```bash
./scripts/run.sh            # boot in QEMU
./scripts/smoke-alpha.sh    # release gate: 10 checks, one PASS/FAIL line
./scripts/test-host.sh      # host unit tests
./scripts/run-hw.sh         # flash and run on NUCLEO-F411RE

# talk to a running kernel over USART2
cargo build --release -p maataa-link --features cli
target/release/maataa-link --serial /dev/cu.usbmodem1103 selftest
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
- [Host channel](docs/host-channel.md)
- [Signed capsules and capabilities](docs/capsules.md)
- [WebAssembly capsules](docs/wasm-capsules.md)
- [Persistent storage](docs/persistence.md)
- [Watchdog and crash report](docs/watchdog.md)
- [Scheduler](docs/engineering/SCHEDULER.md)
- [IPC frame schema](docs/IPC_FRAME_SCHEMA.md)
- [MSAR frame matrix](docs/MSAR_FRAME_MATRIX.md)
