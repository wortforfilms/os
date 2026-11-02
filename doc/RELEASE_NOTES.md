# Unreleased (after v0.1.0-alpha.3)

## Panini capsule (vowel sandhi)

| Feature | Board | Docs |
| --- | --- | --- |
| `crates/maataa-sandhi`: vowel sandhi (6.1.77, 6.1.78, 6.1.87, 6.1.88, 6.1.101, 6.1.109) over SLP1, `no_std` | host tests | docs/panini.md |
| `capsules/panini.wat`: the same rules as a run-time capsule; requests in key 40, answers in key 41; checked against the crate for every pair of boundary letters | yes (2026-11-01, 8 requests) | docs/panini.md |
| `scripts/qemu-panini-test.sh` (smoke step 15) | QEMU | docs/panini.md |
| Manifest key `log=quiet`: the kernel logs a capsule's tick only when it returns a negative result; panini version 2 uses it (no more log line a second) | installed and answering (v2, 2026-11-01); the quiet log itself checked in QEMU | docs/wasm-capsules.md |
| `maataa_sandhi::varna`: the 49 phonemes with place, effort, voicing, aspiration and length; the Maheshvara sutras; pratyaharas computed from them (with the ण् choice explicit); 1.1.69 savarna widening; 1.1.9/1.1.10 savarna | host tests | docs/panini.md |
| `join` rewritten on the varna model (pratyaharas, savarna, 1.1.50 closest substitute); agrees with the first engine on all 49×49 boundary pairs in three contexts; f+x kept at 6.1.77 as an open exception | host tests | docs/panini.md |
| Visarga, s and r before a word: 6.1.113, 6.1.114, 6.1.132, 8.3.17 with 8.3.19 / 8.3.22, 8.3.34 with 8.4.40 / 8.4.41, 8.3.35, 8.3.36, 8.3.37, r kept; 21 textbook cases; 8.3.14 refused as not yet | host tests | docs/panini.md |
| `scripts/sizecheck.sh` builds and checks all four kernels (F411 and QEMU, release and debug): fails over 128 KiB, warns above 90% (both debug builds warn at 91%) | - | docs/size.md |
| panini version 3: the same rules with its constants in one data segment (was 7 of 8), leaving room for the visarga rules | yes (2026-11-01: installed, 4 MATCH, malformed refused) | docs/panini.md |
| panini version 4: the visarga rules (8 to 17, and -105) in the capsule, equal to the crate on about 58,800 requests; image 2,164 bytes, worst fuel 4,758 | yes (2026-11-02: 8 MATCH incl. रामो गच्छति, राम इति, रामश् च, हरिर् गच्छति, स गच्छति, रामोऽत्र, देवा गच्छन्ति; हरिः+रमते refused by both) | docs/panini.md |
| Hal sandhi (host library): 8.2.39, 8.4.40, 8.4.41, 8.4.45, 8.4.55, 8.4.60, 8.4.62, 8.4.63, 8.3.23 for final stops and m; 18 textbook cases and a property test; fixes `vAk+ISa` (was `vAkISa`, now `vAgISa`) | host tests | docs/panini.md |
| panini version 5: hal sandhi (rules 18 to 26, and -105) in the capsule, equal to the crate on about 109,000 requests; image 2,909 bytes, worst fuel 4,883 | yes (2026-11-02: 8 MATCH incl. वागीश, तच्च, सज्जन, तच्छिव, तद्धित, किं करोति, रामो गच्छति, देवेन्द्र; वाच्+ईश refused by both) | docs/panini.md |
| `maataa-link sandhi देव+इन्द्र`: Devanagari or SLP1 in, the board's answer checked against the host's (`MATCH`/`MISMATCH`); `maataa_sandhi::lipi` converts, refusing unsupported characters | yes (2026-11-01, 11 requests) | docs/panini.md |

Board run (NUCLEO-F411RE, kernel v0.1.0-alpha.3, 2026-11-01): panini
installed over the host channel (1407 bytes, replacing greeter) and run as
task 9 after a probe reset. Answers read back from key 41: deva+indra ->
devendra, mahA+fzi -> maharzi, eka+eka -> ekEka, iti+Adi -> ityAdi,
vane+atra -> vane'tra, hare+e -> haraye, vAk+ISa -> vAkISa, deva+in+dra ->
?. Key 40 was deleted after each; STATUS tasks 8/10 alive.

# Maataa OS v0.1.0-alpha.3

## Release type

Kernel alpha for QEMU (`netduinoplus2`) and the NUCLEO-F411RE board: the
scheduler release. Every feature below passed the QEMU smoke test (14/14)
and CI; the "Board" column says what was also run on a NUCLEO-F411RE.

## Validation

```bash
./scripts/smoke-alpha.sh          # 14 checks, QEMU (step 14: priority inversion)
./scripts/sizecheck.sh            # kernel within 128 KiB
./scripts/board-test.sh           # NUCLEO-F411RE: build, flash, host-channel checks
```

`scripts/board-test.sh` needs ST-LINK firmware V2J49M36 or newer (STSW-LINK007).
The board's V2J33M25 (2019) stalled the serial port after every probe-rs
flash or reset until a USB replug; after the update it passed with no
replug (2026-11-01).

## Strict priority scheduling (cede19a)

| Feature | Board | Docs |
| --- | --- | --- |
| Strict priority levels, round-robin within a level; host channel at 6, capsules 1 to 4 from `priority=` in the signed manifest | yes (2026-11-01) | docs/engineering/SCHEDULER.md |
| Syscall 19 `park` (no capability needed; `E_BUSY` while holding a mutex) | yes | src/syscall.rs |
| Switch at once when a woken task outranks the running one; semaphore posts go to the highest waiter | yes | docs/engineering/SCHEDULER.md |

Board run on a NUCLEO-F411RE, host channel round trip (`maataa-link ping`,
20 pings each):

| Firmware | Selftest | STATUS | Ping |
| --- | --- | --- | --- |
| 7e4830f (round-robin) | pass | tasks 8/10 alive | 15 to 21 ms, median 20.5 ms |
| cede19a (strict priority) | pass | tasks 8/10 alive | 2 to 3 ms, median 2 ms |

The host channel now preempts task 1's busy loop as soon as a UART byte
wakes it, instead of waiting for the quantum and its turn among the other
tasks. Tasks 4 and 5 are killed by the protection tests, as before; parked
tasks count as alive. The start order (task 2, task 3, task 1) is checked
in QEMU; the board's RTT log was not captured in this run.

## Priority inheritance, robust mutexes, starvation monitor

| Feature | Board | Docs |
| --- | --- | --- |
| A lock owner runs at the level of its highest waiter, along chains, for late waiters, and falls back on release; feature `pi-off` turns it off for comparison | QEMU and host tests | docs/engineering/SCHEDULER.md |
| Mutex unlock goes to the highest waiter (oldest among equals) | QEMU and host tests | docs/engineering/SCHEDULER.md |
| Waiting that would close a lock cycle fails with `E_DEADLOCK` | host tests | docs/engineering/SCHEDULER.md |
| A task that dies holding a lock: the next owner gets `E_OWNER_DIED` (u32::MAX - 18; it owns the lock) | QEMU (demo task 2) and host tests | docs/engineering/SCHEDULER.md |
| Starvation monitor: a task Ready 1000 ms without running is logged once per episode; the count is kernel key 3 | yes (key 3 read 0 over the host channel) | docs/engineering/SCHEDULER.md |

`scripts/qemu-inversion-test.sh` (step 14 of the smoke test) runs the
classic inversion with and without inheritance under `-icount`.

Board run (NUCLEO-F411RE, e13f3a1, 2026-11-01): host channel selftest
passed, STATUS tasks 8/10 alive, kernel key 3 read 0 (no starvation in the
demo), 20 pings at 2 to 3 ms (median 2 ms, as before). The inheritance,
cycle and dead-owner paths are checked in QEMU and host tests; the board's
RTT log (which would show task 2's EOWNERDEAD line) was not captured.

## Known limits

- Inheritance, lock cycles and the dead-owner hand-off ran on the board's
  firmware but were only observed in QEMU and host tests: the board run
  reads the host channel, not the kernel's RTT log.
- Under strict priority a busy task starves every level below it; the
  starvation monitor reports it but does not intervene.
- Earlier limits still hold: one run-time capsule at a time, the store's
  rollback counter is opt-in and untested on a board, and the development
  keys are public.

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
| Run-time capsule install over the host channel (flash sector 5, task 9) | yes (greeter, 2026-11-01) | docs/capsules.md |
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
