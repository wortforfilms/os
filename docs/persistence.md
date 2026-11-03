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

- **Freshness, by default.** Someone with the flash can put back an older
  copy of it, or cut records off the end of the log (mount treats that like
  a power cut). The `otp-rollback` feature catches the first
  ([Rollback counter](#rollback-counter)); nothing catches the second.
- **A re-formatted store, by default.** After the flash is erased, the store
  starts again at generation 1, and nonces repeat those of the erased data.
  Someone who kept a copy of the old flash could compare the two. With
  `otp-rollback`, a re-formatted store starts at the counter's generation
  instead, so the nonces do not repeat.

## Rollback counter

Built with the `otp-rollback` feature, the store keeps a counter that only
goes up, in one-time-programmable memory
(`crates/maataa-store/src/rollback.rs`):

- **What it counts.** The lowest generation the store may have. Each
  compaction raises the generation by one; right after the new bank's header
  is written, the counter is raised to match. (A power cut between the two
  leaves the counter one behind; the next mount raises it.)
- **What mount does.** If the newest valid bank is older than the counter,
  mount refuses the store (`flash store: not mounted: rolled back to an
  older copy`) and leaves the flash untouched. That catches an older copy
  of the flash put back, and the newest bank erased so that mount would fall
  back to the older one.
- **What it does not catch.** Records cut off the end of the newest bank,
  which has the same generation. A store erased completely is formatted
  again, empty, at the counter's generation.
- **Where the counter lives.** On the F411, the OTP area at
  `0x1FFF_7900`–`0x1FFF_79FF` (blocks 8–15; blocks 0–7 and the lock bytes
  are never touched). One byte is programmed to `0x00` per step, each byte
  only once, so 256 steps: about 256 compactions, or roughly 460,000 writes
  of 64-byte values. When it is full, the boot report says so, and rollback
  is no longer detected. In QEMU it is the host file `target/qemu-otp.bin`,
  whose bytes can be written once each.
- **It cannot be undone.** OTP bytes can never be erased. A board that once
  ran an `otp-rollback` kernel keeps its counter for good, and that counter
  stays readable to any later kernel. The feature is off by default, and
  this project has not yet run it on a board; only the host tests and QEMU
  have.

The boot report shows the counter
(`flash store: rollback counter 2/256 (one-time programmable)`), or
`flash store: rollback counter: off (feature otp-rollback)`.

Tests:

- `cargo test -p maataa-store` runs the counter over an OTP in RAM that
  fails the test if any byte is programmed twice. It checks that:
  - the counter only goes up and stops at its capacity;
  - a torn byte is skipped;
  - an older copy of the flash, and a store whose newest bank was erased,
    are refused;
  - an erased store starts again at the counter;
  - a full counter is reported;
  - the store still mounts with its counter after a power cut at many
    points.
- `scripts/qemu-rollback-test.sh` (part of `smoke-alpha.sh`) builds the
  feature for QEMU. It writes key 30, keeps a copy of the flash file, forces
  a compaction, puts the copy back (mount refuses it), then puts the current
  flash back (key 30 reads back).

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
| 3 | kernel: starvation episodes since boot (u32), served from RAM and never stored ([SCHEDULER.md](engineering/SCHEDULER.md#starvation-monitor)) |
| 4–15 | kernel, reserved |
| 16–31, 63 | host channel scratch (selftest 20, QEMU tests 30, `store-stress` 63, board persistence check 21) |
| 32–35 | the `telemetry` capsule (key 32: its lifetime tick count) |
| 36–39 | nobody yet |
| 40, 41 | panini's request and answer, written by panini and the host channel |
| 42–47 | the `panini` capsule |
| 48–62 | nobody yet |

Tasks may read every key, kernel keys 0–15 included. A task writes only the
keys of its owner: the host channel, or a capsule by its signed name
(`Owner` in `src/storage/persist.rs`); any other write gets `EPERM`.

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
  first run writes a fresh value to key 21 (key 40 until alpha.8). You then
  unplug and replug the USB cable, which cuts the board's power. The second
  run reads key 21 back and compares. That cuts the power while the store
  is idle.
- **Power cut during a write, on the board:** `scripts/board-power-cut-test.sh`
  (`Board power cut test.command`, 3 rounds). In each round `maataa-link
  power-cut-write` writes numbered 64-byte values (`pc 0000001234 …`) to
  key 63 as fast as the board takes them and prints each one the board
  acknowledges; you pull the USB cable while the count climbs and plug it
  back in. `maataa-link power-cut-check N` then requires key 63 to hold
  value N (the last acknowledged) or N+1 (the one in flight), never a torn
  or mixed value, and the store must have mounted. A round counts only if
  the boot count went up, so the board really lost power; otherwise the
  script says so and repeats it. Compaction runs about
  every 1,500 writes on the F411, so some cuts land in it. The host tests
  above cut at every programmed byte in a model of the flash; this run is
  the same check on the real chip.
- The same two commands in QEMU, where the demo ends by itself and so stops
  QEMU in the middle of the writes: three rounds of 1,842, 1,972 and about
  2,000 acknowledged writes each read back the last acknowledged value,
  with compactions in between (generation 11, 21, 31; 2026-11-04, by hand).
- First board run, 2026-11-04 (kernel `bbce5ca`): two real power cuts, after
  5,253 writes (about three compactions before it) and after 8; both read
  back the last acknowledged value. A third round stopped on a serial
  timeout without a new boot (no power cut); it too read back its last
  value, and since then such a round is repeated rather than counted.
- Second board run, 2026-11-04 00:16 (log `target/board-power-cut.txt`):
  four cable pulls, after 474, 1,924, 2,143 and 2,340 acknowledged writes,
  so the last three came after the first compaction. Each ended with the
  USB device gone ("Device not configured"). Rounds 1 and 3 logged a new
  boot (326, 328) with reset cause power-on; in rounds 2 and 4 the first
  boot-info after the reboot timed out (round 2's boot, 327, came from a
  second request). All four read back a valid value: 474, 1925 (the write
  in flight), 2143, 2340. The script wrongly repeated round 3 because its
  second boot-info request failed; it now retries one request up to five
  times and logs and uses that same reply.
- Third board run, 2026-11-04 00:31, with that fix: three power cuts, after
  799, 1,945 and 2,631 acknowledged writes, each with a new boot (330, 331,
  332, reset cause power-on) and each reading back the last acknowledged
  value. One more pull, after 15 writes, only stopped the serial link (a
  timeout, boot count still 330); the script said "NO POWER CUT" and
  repeated the round, as intended.

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
- **Rollback protection is opt-in** (`otp-rollback`), because it writes
  OTP for good; see [Rollback counter](#rollback-counter).
