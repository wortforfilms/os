# Evidence matrix

For each feature: where it is implemented, which test covers it, whether CI
runs that test, and whether it was run on a NUCLEO-F411RE. At `7b99bdb`
(version `0.1.0-alpha.8`; items after it are listed as unreleased in
[release notes](../doc/RELEASE_NOTES.md)).

- **CI** is `.github/workflows/verify.yml`: `cargo fmt --check`, clippy (host
  crates and eight kernel feature sets, warnings are errors),
  `scripts/smoke-alpha.sh` (15 checks) and `scripts/sizecheck.sh`.
- **Board** is a recorded manual run: `scripts/board-test.sh` or a
  `maataa-link` session, with the date from the release notes. A board run
  is evidence for that build only; CI has no board.

## Smoke checks (`scripts/smoke-alpha.sh`, `TOTAL=15`)

| # | Check |
| --- | --- |
| 1 | F411 target build |
| 2 | default QEMU target build |
| 3 | F411 dependency tree excludes semihosting |
| 4 | both-board features fail cleanly |
| 5 | host unit tests (`cargo test`; the host crates; `maataa-sandhi --features alloc`) |
| 6 | release build |
| 7 | size check |
| 8 | QEMU boot and boot report |
| 9 | QEMU clock self-test |
| 10 | QEMU host channel |
| 11 | QEMU persistent store |
| 12 | QEMU run-time capsule install |
| 13 | QEMU store rollback counter (`otp-rollback`) |
| 14 | QEMU priority inheritance (`inversion-test`, `pi-off`) |
| 15 | QEMU panini capsule (sandhi through the store) |

## Features

| Feature | Source | Test | CI | Board |
| --- | --- | --- | --- | --- |
| strict-priority scheduler | `src/sched/` | 30 unit tests; smoke 8 (scheduler line, mutex and semaphore hand-off) | yes | yes |
| priority inheritance, robust mutexes | `src/sched/` | unit tests; smoke 14; `scripts/board-inversion-test.sh` | yes | not yet (script ready, not run) |
| MPU task isolation, kernel stack guard | `src/mpu.rs` | 5 unit tests; smoke 8 (task 4's kernel-RAM write and task 5's stack overflow are killed, kernel word untouched); `kernel-stack-test` clippy build | yes | yes |
| capability mask on SVCs | `src/syscall.rs`, `src/sched/` | 6 syscall unit tests; smoke 8 (`ENOCAP` lines) | yes | yes |
| IPC mailboxes | `src/ipc/` | unit tests in `src/ipc/` (19, 4 of them mailbox) | yes | yes |
| clock (100 MHz F411 / QEMU tick) | `src/clock.rs` | smoke 9 | yes | yes |
| watchdog | `src/watchdog.rs` | 1 unit test; `watchdog-test` clippy build | build only | yes |
| reset cause, crash record | `src/crash.rs` | 2 unit tests | yes | yes |
| host channel (COBS, CRC-32) | `crates/maataa-link`, `src/hostlink.rs` | host crate tests; 1 hostlink test; smoke 10 | yes | yes (`board-test.sh`) |
| signed capsules (ed25519) | `crates/maataa-capsule`, `src/capsule/` | 12 crate tests; smoke 8 (`capsule tamper check: rejected`) | yes | yes |
| WASM interpreter | `crates/maataa-wasm` | 19 crate tests; 7 `capsule_task` tests | yes | yes |
| run-time capsule install, version floors | `src/installed.rs` | 4 unit tests; smoke 12 | yes | yes |
| persistent store (ChaCha20-Poly1305, chip-bound key) | `crates/maataa-store`, `src/storage/persist.rs` | 24 crate tests; 3 persist tests; smoke 11 | yes | yes |
| store rollback counter in OTP | `crates/maataa-store/src/rollback.rs` | smoke 13 (QEMU file stands in for OTP) | yes | no, on purpose (OTP is one-time) |
| size limit (128 KiB kernel) | `scripts/sizecheck.sh` | sizecheck | yes | — |
| release build with release keys | `scripts/release.sh` | — (needs the keys; run by hand) | no | yes (alpha.6) |
| sandhi library | `crates/maataa-sandhi` | crate tests (`lib.rs`, `lipi.rs`, `varna.rs`) | yes | — (host) |
| panini capsule v9 | `capsules/panini.wat` | `the_panini_capsule_agrees_with_its_reference`; smoke 15 | yes | yes (2026-11-02, 18 requests) |
| `maataa-link sandhi` (MATCH / MISMATCH) | `crates/maataa-link/src/main.rs` | host crate tests | yes | yes |

Per-rule evidence for the sandhi rules is in
[PANINI_RULE_REGISTRY.md](PANINI_RULE_REGISTRY.md).
Per-SVC coverage is in [SVC_TEST_COVERAGE.md](SVC_TEST_COVERAGE.md).

## Not covered

- No CI job runs on hardware; every "Board: yes" is a manual run that can go
  stale after a later change.
- Board runs must keep the Mac awake. On 2026-11-03 the NUCLEO-F411RE
  reset several times (boot 241 to 246, cause `reset pin or debugger`, no
  crash record) while the Mac went to sleep; a request in flight then got
  no answer. With the Mac kept awake (`caffeinate`), the same board ran
  30 minutes with no reset (uptime 3,167 to 4,996 s, read every 10 s, no
  missed reply), and opening the serial port once a second for 90 s did not
  reset it either. The reset comes from the ST-LINK when the Mac's USB
  sleeps, not from the kernel.
- `src/drivers/` (a registry with simulated uart and spi slots) has unit
  tests only and touches no hardware; the real board code is
  `src/board.rs`.
