# Persistent storage

The kernel now has a key-value store that keeps its values across reboots and
power loss. Every value is encrypted and authenticated
([Sealing](#sealing)).

- The kernel counts boots in it (key 0) and prints `boot count: N`.
- Tasks use it through syscalls 15 (get) and 16 (put).
- The host reaches it through the host channel's `STORE_GET` and `STORE_PUT`
  messages, served by task 6.

Code locations:

- Format, sealing, power-loss safety and compaction: `crates/maataa-store`.
- Board backends, the store key and the kernel API: `src/storage/persist.rs`.
- Reading the board's store with a probe: `scripts/read-board-store.py`.

## Where the data lives

| Board | Banks | How |
| --- | --- | --- |
| NUCLEO-F411RE | flash sectors 6 and 7 (`0x0804_0000`, `0x0806_0000`), 128 KiB each | FLASH registers: byte programming, sector erase, data cache reset afterwards |
| QEMU | two 16 KiB banks in `target/qemu-flash.bin` on the host | semihosting file I/O, because QEMU does not model flash writes. The file survives between QEMU runs. |

`memory.x` limits the kernel to sectors 0–4 (128 KiB), so building or
flashing the kernel can never overwrite the store, or the run-time capsule
area in sector 5. `scripts/sizecheck.sh` enforces the same 128 KiB limit.
Debug builds are size-optimised too (`opt-level = "z"` with LTO, overflow
checks on, debug assertions off), so they fit as well.

## Format and safety

```text
bank:   [header 32 B][record][record]...[0xFF ...]
header: "MKV2" | generation u32 | key id u32 | 0xFFFF_FFFF | tag (16 B)
record: key u8 | length u8 | 0xFF 0xFF | sealed value, padded to 4 | tag (16 B)
```

- **Writes append a record.** The newest record for a key wins. A value of
  length 0 deletes the key. A RAM index (64 keys) points at each key's newest
  record, so reads do not scan flash.
- **Each record's tag is written last.** A record cut short by power loss
  fails its tag. Mount stops reading at that record and moves the live data
  to the other bank.
- **Compaction.** When a bank is full, the live records are copied to the
  other bank, which is erased first. Its header, carrying the next generation
  number, is written last. If power fails before the header is written, the
  old bank is still the newest valid one.
- **Mount** picks the valid header with the highest generation. If neither
  bank has one, it formats bank 0.

## Sealing

Each value is encrypted and authenticated with ChaCha20-Poly1305 (RustCrypto
`chacha20poly1305`, pure Rust, no allocation).

- **Key.** The build has a 256-bit master key. The kernel binds it to the
  chip: the store key is the ChaCha20 keystream under the master key with the
  chip's 96-bit unique id (`0x1FFF_7A10`) as nonce. A flash image copied to
  another board does not open there.
  - **Development (default):** a master key that is public in `build.rs`.
    Like the development capsule key, it proves only that the data was not
    corrupted or changed by someone who does not have this source. The boot
    report says
    `flash store: sealed with ChaCha20-Poly1305, development (public; integrity only) key bound to this chip, id 61d247ae` (QEMU; each board shows its own id).
  - **Release:** set `MAATAA_STORE_KEY` (64 hex characters) at build time.
    The key is then in the firmware image, so it stays secret only if the
    flash cannot be read out: enable the F411's read-out protection (RDP
    level 1) on boards that hold real data.
- **Nonce.** The bank's generation and the record's offset. Within a bank
  every offset is written once, and every compaction raises the generation,
  so no nonce is used twice while the store lives.
- **What is authenticated.** The value, the record's key and length, and its
  position (through the nonce). The header has a tag of its own, so a bank
  cannot be made to win by raising its generation.
- **Key id.** The header carries 4 bytes derived from the store key. If the
  flash holds a store sealed with a different key, mount refuses it
  (`sealed with a different key`) and leaves it untouched, rather than
  formatting over it. Erase it with the probe to start again.
- **Reads check again.** `get` checks the tag on every read, so a value
  changed after mount is reported as corrupt, and nothing of it is returned.

What sealing does not do:

- **Freshness.** Someone with the flash can put back an older copy of it, or
  cut records off the end of the log (mount treats that like a power cut).
  Detecting that needs a counter they cannot reset, such as one in the
  F411's one-time-programmable area. Not done yet.
- **A re-formatted store.** After the flash is erased, the store starts
  again at generation 1, and nonces repeat those of the erased data. Someone
  who kept a copy of the old flash could compare the two.

## Migration from the unsealed format

Boards that ran the earlier kernel have a store in the unsealed format
(`MKV1`: CRC-32 instead of tags, values in the clear). On the first boot of
this kernel, mount reads that store once, seals its live values into the
other bank (generation + 1), and then erases the unsealed bank. The boot
report says `(sealed the unsealed store)`, and the boot count carries on.

This happens only when neither bank holds a sealed header. Once a store is
sealed, unsealed data is ignored, so an unsealed bank written later, with any
generation, cannot replace it.

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
- **Sealing:**
  - no value appears in the flash in the clear;
  - every single-bit change to a record is caught, and the changed value is
    never returned, both at mount and on a read after mount;
  - a record copied to another offset does not open;
  - a store sealed with another key is refused and left byte-for-byte
    unchanged;
  - an unsealed store is migrated once and its bank erased, and an unsealed
    bank with a higher generation next to a sealed store is ignored;
  - device keys differ between chips.

## Keys and access

| Keys | Owner |
| --- | --- |
| 0 | kernel: boot count (u32, little-endian) |
| 1 | kernel: last reset cause and crash ([watchdog.md](watchdog.md)) |
| 2 | kernel: version floors of run-time capsules ([capsules.md](capsules.md#installing-a-capsule-at-run-time)) |
| 3–15 | kernel, reserved |
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
  four times:
  1. On a fresh store file: writes key 30 and checks that the store was
     formatted.
  2. Makes 260 writes of 64 bytes, enough to force a compaction of the
     16 KiB bank.
  3. Reads key 30 back and checks that the generation advanced, that the
     store is sealed, and that the value is not in the file in the clear.
  4. Replaces the file with a store in the unsealed format (boot count 41,
     key 30) and checks that it is migrated: boot count 42, key 30 reads
     back, and its old bank no longer holds the value.

  Runs 1–3 must each report the next boot count.
- `scripts/read-board-store.py` decrypts the store itself (a small Python
  ChaCha20-Poly1305, checked against the RFC 8439 test vector and against
  the kernel's key id). `--file target/qemu-flash.bin` reads the QEMU store.
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

## Board verification of sealing (NUCLEO-F411RE, 2026-10-31)

The board's store was in the unsealed format, from the earlier kernel, with
boot count 53. After flashing this kernel, `scripts/read-board-store.py`
(through the probe, without the serial port) showed:

```text
store: bank 1, generation 2, sealed, key id 38b642be, keys [0, 1, 20, 32, 40]
boot count: 57
reset cause: software reset
last crash: none
telemetry capsule lifetime ticks (key 32): 54
```

- The unsealed bank 0 (generation 1) was migrated to sealed bank 1
  (generation 2), and the values in keys 20, 32 and 40 carried over.
- The board's key id (`38b642be`) differs from QEMU's (`61d247ae`): the key
  is bound to the chip's unique id.
- The boot count went on from 53. Each later probe session resets the
  board, which is why it reads 57.
- Read again 20 s later, nothing had changed: no watchdog reset.
- The host channel selftest then passed on the sealed store: put, get and
  delete of key 20, the refusal of kernel key 0, and `boot info` (boot 63).

## Limits

- **Erase stalls.** Erasing a 128 KiB sector stalls the F411 for about 1–2 s,
  because code runs from the same flash. The kernel clock counts at most one
  missed tick period, so its time falls behind during the stall. Erases
  happen only when the store is first formatted and during compaction. On the
  F411 compaction comes after about 1,800 writes of 64-byte values.
- **Wear.** Each bank is erased once per compaction. STM32F4 sectors are
  rated for 10,000 erase cycles.
- **Development key.** With the default build, anyone with this source and a
  debug probe can still read the values; set `MAATAA_STORE_KEY` and enable
  read-out protection to keep them secret.
- **No rollback protection** (see [Sealing](#sealing)).
