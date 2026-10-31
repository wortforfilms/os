# Persistent storage

The kernel now has a key-value store that keeps its values across reboots and
power loss.

- The kernel counts boots in it (key 0) and prints `boot count: N`.
- Tasks use it through syscalls 15 (get) and 16 (put).
- The host reaches it through the host channel's `STORE_GET` and `STORE_PUT`
  messages, served by task 6.

Code locations:

- Format, power-loss safety and compaction: `crates/maataa-store`.
- Board backends and the kernel API: `src/storage/persist.rs`.

## Where the data lives

| Board | Banks | How |
| --- | --- | --- |
| NUCLEO-F411RE | flash sectors 6 and 7 (`0x0804_0000`, `0x0806_0000`), 128 KiB each | FLASH registers: byte programming, sector erase, data cache reset afterwards |
| QEMU | two 16 KiB banks in `target/qemu-flash.bin` on the host | semihosting file I/O, because QEMU does not model flash writes. The file survives between QEMU runs. |

`memory.x` limits the kernel to sectors 0–5 (256 KiB), so building or
flashing the kernel can never overwrite the store. `scripts/sizecheck.sh`
enforces the same 256 KiB limit. Debug builds are size-optimised (`opt-level
= "z"` with LTO) so they fit too.

## Format and safety

```text
bank:   [header 16 B][record][record]...[0xFF ...]
header: "MKV1" | generation u32 | 0xFFFF_FFFF | CRC-32 of bytes 0..12
record: key u8 | length u8 | 0xFF 0xFF | value, padded to 4 | CRC-32
```

- **Writes append a record.** The newest record for a key wins. A value of
  length 0 deletes the key. A RAM index (64 keys) points at each key's newest
  record, so reads do not scan flash.
- **Each record's CRC is written last.** A record cut short by power loss
  fails its CRC. Mount stops reading at that record and moves the live data
  to the other bank.
- **Compaction.** When a bank is full, the live records are copied to the
  other bank, which is erased first. Its header, carrying the next generation
  number, is written last. If power fails before the header is written, the
  old bank is still the newest valid one.
- **Mount** picks the valid header with the highest generation. If neither
  bank has one, it formats bank 0.

`cargo test -p maataa-store` uses a RAM flash that behaves like NOR flash:
programming can only clear bits, and programming a byte that is not erased
fails the test. The tests cover:

- **Power cuts:** they cut power after every possible number of programmed
  bytes, across a sequence of writes that includes compactions. After each
  cut, every key must read back its last completed value or the one being
  written, and the store must keep working.
- **Damaged header:** the newest bank's header is corrupted; mount falls back
  to the older bank.
- **Limits:** compaction keeps the newest values, and a live data set that
  does not fit is reported as full.

## Keys and access

| Keys | Owner |
| --- | --- |
| 0 | kernel: boot count (u32, little-endian) |
| 1 | kernel: last reset cause and crash ([watchdog.md](watchdog.md)) |
| 2–15 | kernel, reserved |
| 16–63 | tasks, with the `store_get` / `store_put` capabilities (key 32: the telemetry capsule's lifetime tick count) |

Tasks may read kernel keys 0–15 but not write them.

Values are at most 64 bytes. Writes to kernel keys get `EPERM`, and
calls outside the task's capability mask with `ENOCAP`. A missing key gives
`ENOENT`. The signed hostlink capsule (task 6) and telemetry capsule (task 7)
grant `store_get` and `store_put`.

## From the host

```bash
target/release/maataa-link --serial /dev/cu.usbmodem11303 put 20 hello
target/release/maataa-link --serial /dev/cu.usbmodem11303 get 20
target/release/maataa-link --serial /dev/cu.usbmodem11303 put 20          # delete
```

The host channel `selftest` now also checks these:

- put, then get back the same value
- a deleted key reads as not found
- key 0 (the boot count) is refused

## Tests

- `scripts/qemu-persistence-test.sh` (part of `smoke-alpha.sh`) runs QEMU
  three times on a fresh store file:
  1. writes key 30 and checks that the store was formatted
  2. makes 260 writes of 64 bytes, enough to force a compaction of the
     16 KiB bank
  3. reads key 30 back and checks that the generation advanced
  
  Each run must report the next boot count.
- On the board, `Board persistence check.command` runs in two steps. The
  first run writes a fresh value to key 40. You then unplug and replug the
  USB cable, which cuts the board's power. The second run reads key 40 back
  and compares.

## Board verification (NUCLEO-F411RE, 2026-10-31)

- The host channel selftest passed, including store put, get and delete,
  and the refusal of kernel key 0. `STATUS` showed 6 of 8 tasks alive, which
  means the WebAssembly task 7 is running too.
- `power-cycle-120335` was written to key 40. After a real power cycle (USB
  cable out and back in), key 40 still held that value.
- The first board run found a bug that QEMU could not show, because QEMU
  keeps the store in a host file rather than in flash. MPU region 0 made
  flash read-only for the kernel as well as for tasks, so the first put from
  a syscall faulted and the board stopped answering. The kernel may now
  write flash; tasks still only read it (`src/mpu.rs`).

## Limits

- **Erase stalls.** Erasing a 128 KiB sector stalls the F411 for about 1–2 s,
  because code runs from the same flash. The kernel clock counts at most one
  missed tick period, so its time falls behind during the stall. Erases
  happen only when the store is first formatted and during compaction. On the
  F411 compaction comes after about 1,800 writes of 64-byte values.
- **Wear.** Each bank is erased once per compaction. STM32F4 sectors are
  rated for 10,000 erase cycles.
- **No encryption or authentication.** Anyone with a debug probe can read or
  change the values.
