# Hardware memory map

The canonical flash and RAM layout, from `memory.x`, `src/installed.rs`,
`src/storage/persist.rs` and `src/mpu.rs` at `7b99bdb`. The source is the
authority; this page describes it.

## NUCLEO-F411RE (STM32F411RET6)

512 KiB flash in 8 sectors, 128 KiB SRAM, Cortex-M4F at 100 MHz
(`docs/kernel-clock.md`).

### Flash

| Sector | Address | Size | Use | Defined in |
| --- | --- | --- | --- | --- |
| 0 | `0x0800_0000` | 16 KiB | kernel image | `memory.x`: `FLASH ORIGIN = 0x08000000, LENGTH = 128K` |
| 1 | `0x0800_4000` | 16 KiB | kernel image | |
| 2 | `0x0800_8000` | 16 KiB | kernel image | |
| 3 | `0x0800_C000` | 16 KiB | kernel image | |
| 4 | `0x0801_0000` | 64 KiB | kernel image | |
| 5 | `0x0802_0000` | 128 KiB | run-time capsule area (one signed image) | `src/installed.rs` (`maataa_store::area`) |
| 6 | `0x0804_0000` | 128 KiB | persistent store, bank A | `src/storage/persist.rs` (`BANK_SIZE = 128 KiB`) |
| 7 | `0x0806_0000` | 128 KiB | persistent store, bank B | |

- Sectors 0–4 total 128 KiB. `scripts/sizecheck.sh` fails any kernel over
  131,072 bytes and warns above 90 % (`docs/size.md`). Container builds on
  2026-11-02: F411 release about 102 KB, debug about 116 KB.
- The kernel never links into sectors 5–7; `memory.x` keeps the image below
  them. `probe-rs run` / `download` rewrite only the sectors the ELF covers,
  so flashing a new kernel leaves the capsule area and the store as they
  are. `probe-rs erase` (whole chip) clears them.
- Writing sectors 5–7 is the kernel's job only (MPU: privileged read/write,
  unprivileged read-only; see below). The flash controller stays locked
  except during those writes.

### System memory used by the kernel

| Address | What | Use |
| --- | --- | --- |
| `0x1FFF_7A10` | 96-bit unique device id (read-only) | binds the store key to this chip (`persist::device_id`) |
| `0x1FFF_7900` | OTP blocks 8–15 | store rollback counter, only with the `otp-rollback` feature (off by default; never written on the project's board). Blocks 0–7 and the lock bytes at `0x1FFF_7A00` are never touched |

### RAM

| Region | Address | Notes |
| --- | --- | --- |
| SRAM | `0x2000_0000`, 128 KiB | `memory.x`: `RAM LENGTH = 128K`; `_stack_start` = top of RAM |
| static data | from `0x2000_0000` | about 84.1 KiB in the F411 release build (`docs/size.md`), of which about 17 KiB is alignment padding |
| capsule task stacks | `.bss` | three 16 KiB stacks (task 9's is reserved even with no capsule installed) |
| demo task stacks | `.bss` | six 2 KiB stacks, each aligned to 2 KiB for its MPU region (`src/main.rs`, `TASK_STACK_BYTES`) |
| install scratch | `.bss` | 4 KiB buffer for run-time capsule install |
| kernel stack | between `__sheap` and the top of RAM | about 43.9 KiB; a 256-byte no-access MPU guard at the first 256-aligned address above `__sheap` |

## MPU regions (`src/mpu.rs`)

| Region | Memory | Kernel (privileged) | Tasks (unprivileged) |
| --- | --- | --- | --- |
| background | everything | default memory map (`PRIVDEFENA`) | no access |
| 0 | flash, first 512 KiB | read, write, execute (`AP_PRIV_RW`) | read, execute |
| 1 | the running task's stack | read, write | read, write, never execute |
| 2 | kernel stack guard, 256 bytes | no access | no access |

Region 1 is reprogrammed on every context switch. A task stack must be a
power of two of at least 32 bytes, aligned to its own size.

## QEMU (`netduinoplus2`, STM32F405 model)

QEMU does not model flash writes, so the store and the capsule area live in
host files through semihosting: the store in two 16 KiB banks in
`target/qemu-flash.bin`, the capsule area in its own file
(`src/installed.rs`, `scripts/qemu-capsule-install-test.sh`). The device id
is the constant `"qemu-netduin"`.

## Known drift in the source

`src/storage/flash.rs` and `src/storage/mod.rs` still hold the alpha.1
*virtual* storage manager (`StorageManager`, boot line `storage mounted:
virtual flash`), whose constants (`SYSTEM_KERNEL_SECTOR_*` up to
`0x001F_FFFF`, `ROLLING_DATABASE_SECTOR_START = 0x2000_0000`, ...) do not
describe this chip and are not used for any real flash access. The real
store is `src/storage/persist.rs` with `crates/maataa-store`. The unused `embassy-*`
dependencies in `Cargo.toml` are the same kind of leftover. The old
constants should be removed or renamed in a code change; this page does not
change code.
