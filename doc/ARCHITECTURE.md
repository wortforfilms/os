# Maataa OS Architecture

## Alpha Architecture

The `v0.1.0-alpha.1` release is a QEMU-first kernel prototype. It proves the
boot flow and subsystem contracts before the real hardware drivers, filesystem,
and WASM execution engine are completed.

```text
Applications / capsule images
        |
Static capsule table
        |
Kernel scheduler simulation
        |
Virtual drivers + virtual storage
        |
Cortex-M runtime + semihosting
        |
QEMU netduinoplus2 machine
```

## Boot Flow

1. `src/main.rs` starts through `cortex-m-rt`.
2. `src/kernel.rs` creates the driver registry, storage manager, and capsule
   manager.
3. The driver registry marks UART, GPIO, SPI, I2C, and power as ready.
4. The storage manager mounts virtual flash and records the system manifest.
5. The capsule manager loads the bundled demo capsule bytes and a control
   capsule placeholder.
6. The scheduler simulation runs six ticks.
7. The kernel exits QEMU through semihosting.

## Current Components

- **Kernel**: deterministic boot and scheduler simulation.
- **Drivers**: virtual readiness and polling model.
- **Storage**: in-memory manifest that stands in for flash metadata.
- **Capsules**: static slot table with size and cycle accounting.
- **Runtime**: Cortex-M `no_std` executable with QEMU semihosting output.

## Memory Model

The linker script declares the emulated device layout:

```text
FLASH: 0x0800_0000, 512K
RAM:   0x2000_0000, 128K
```

The alpha capsule manager reserves a fixed logical capsule budget of 64 KiB.
This is an accounting model only; it is not MPU-backed isolation yet.

## Future Architecture

The dormant source files under `src/capsule/`, `src/storage/`, and
`src/drivers/` sketch the intended real subsystems. They are not part of the
current QEMU alpha build surface until their dependencies and hardware contracts
are completed.
