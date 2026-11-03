# Maataa OS System Manifest

What the kernel is at `v0.1.0-alpha.8`, from the source. Details are in the
linked docs; the evidence for each item is in
[EVIDENCE_MATRIX.md](../docs/EVIDENCE_MATRIX.md).

## Overview

A Rust `no_std` kernel for Cortex-M4 that runs signed WebAssembly capsules
as unprivileged tasks. Alpha, for one development board and QEMU.

## Hardware

| | NUCLEO-F411RE | QEMU |
| --- | --- | --- |
| chip | STM32F411RET6, Cortex-M4F, 100 MHz | `netduinoplus2` (STM32F405 model), 168 MHz |
| flash | 512 KiB: kernel 128 KiB, capsule 128 KiB, store 2 × 128 KiB | store and capsule area in host files |
| RAM | 128 KiB SRAM used (`memory.x`) | same |
| I/O used | USART2 (PA2/PA3, 115200), user LED, IWDG, chip id | USART2 model, semihosting |

Layout: [HARDWARE_MEMORY_MAP.md](../docs/HARDWARE_MEMORY_MAP.md).

## Kernel

- **Scheduler:** preemptive (PendSV), strict priority, round-robin within a
  level, priority inheritance and robust mutexes
  ([SCHEDULER.md](../docs/engineering/SCHEDULER.md)).
- **Memory:** static allocation; MPU region per task stack; kernel stack
  guard ([kernel-mpu.md](../docs/kernel-mpu.md)).
- **System calls:** 19 SVCs, each gated by the task's capability mask
  ([ABI_SVC.md](../docs/ABI_SVC.md)).
- **IPC:** mailboxes (64-byte messages), 4 mutexes, 4 semaphores
  ([kernel-ipc.md](../docs/kernel-ipc.md)).
- **Clock:** SysTick 1 kHz ([kernel-clock.md](../docs/kernel-clock.md)).
- **Watchdog and crash record** ([watchdog.md](../docs/watchdog.md)).

## Capsules

- **Format:** MCAP, ed25519-signed manifest (name, version, capabilities,
  schedule) ([capsules.md](../docs/capsules.md)).
- **Engine:** `crates/maataa-wasm`, an own `no_std` interpreter for an i32
  subset; 4 KiB memory, 20,000 fuel per call
  ([wasm-capsules.md](../docs/wasm-capsules.md)). Not wasmi; wasmi is used
  only in host tests as a reference.
- **Isolation:** each capsule is its own unprivileged task; its imports are
  SVCs, so its signed capabilities bind it.
- **Install:** one run-time capsule in sector 5 over the host channel; the
  commit and a remove are signed host requests
  ([SECURITY_DESIGN.md](../docs/SECURITY_DESIGN.md)).

## Storage

- Sealed key-value store (ChaCha20-Poly1305, key bound to the chip id),
  two banks, power-loss safe, 64 keys of up to 64 bytes
  ([persistence.md](../docs/persistence.md)). No filesystem, no JSON
  configuration.

## Host side

- `maataa-link`: host channel tool (COBS + CRC-32 over USART2)
  ([host-channel.md](../docs/host-channel.md)).
- `maataa-capsule`: build and sign capsules.

## Not in the kernel

- SPI, I2C, ADC, power management, a timer driver: none. `src/drivers/`
  holds a simulated driver registry (uart, spi) that only reports
  `drivers: N/M ready` at boot.
- Secure boot of the kernel image; RDP and OTP are not set on the project's
  board ([threat model](../docs/SECURITY_THREAT_MODEL.md)).
- Embassy, LittleFS, defmt, and wasmi on target: not used.
