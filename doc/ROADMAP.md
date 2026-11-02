# Maataa OS Roadmap

Status at `v0.1.0-alpha.6` and the unreleased work after it. A checked item
is implemented and tested; where it was run is in
[EVIDENCE_MATRIX.md](../docs/EVIDENCE_MATRIX.md). Phase 1 was the
alpha.1 plan; later phases are kept with their real outcome.

## Phase 1: QEMU Alpha (alpha.1)

- [x] Parseable Cargo manifest
- [x] Cortex-M `no_std` boot path
- [x] QEMU semihosting boot logs
- [x] Virtual driver registry (still simulated: `src/drivers/`)
- [x] Virtual storage manifest (still in `src/storage/`; superseded by the
  real store, see [memory map](../docs/HARDWARE_MEMORY_MAP.md#known-drift-in-the-source))
- [x] Static capsule table
- [x] Scheduler simulation (replaced by the real preemptive scheduler)
- [x] Host unit tests for virtual subsystems
- [x] Size check script
- [x] Release smoke script

## Phase 2: Hardware Alpha

- [x] Target board: NUCLEO-F411RE (STM32F411RET6)
- [x] Clock and reset setup (100 MHz; reset cause reported)
- [x] UART logging on hardware (USART2, ST-LINK virtual COM port)
- [x] GPIO output (user LED, SVC 2)
- [x] Kernel tick (SysTick 1 kHz). No general hardware timer driver
  (`src/drivers/timer.rs` is simulated)
- [x] Flashing workflow with `probe-rs` (`scripts/board-test.sh`)
- [x] Fault reporting: MemManage report, crash record, watchdog reset

## Phase 3: Storage And Capsules

- [x] Flash abstraction for the store and capsule sectors
- [ ] LittleFS: not planned; the store is an append-only sealed key-value
  log on sectors 6–7 ([persistence.md](../docs/persistence.md))
- [x] Capsule metadata format (MCAP, signed manifest)
- [x] WASM module loading (own `no_std` i32 interpreter)
- [x] WASM imports for log, strings, sleep, LED and the store
- [x] Run-time install of one capsule (sector 5), active from the next boot
- [ ] More than one run-time capsule; starting one without a reboot

## Phase 4: Security Model

- [x] Capability masks (bit N allows SVC N), from the signed manifest
- [x] Capsule signing and verification (ed25519), version floors
- [x] Memory isolation: MPU per task, kernel stack guard
- [x] System-call policy checks
- [x] Fault containment: a faulting task is killed; a WASM trap ends one call
- [x] Sealed store bound to the chip id
- [ ] Rollback counter on a board (QEMU only; OTP is one-time, so opt-in)
- [ ] Host-channel authentication
  ([threat model](../docs/SECURITY_THREAT_MODEL.md#known-limits))

## Phase 5: Production Readiness

- [x] CI smoke checks (15 checks, clippy, size check)
- [ ] Hardware test in CI (board runs are manual)
- [x] Release artifacts (`scripts/release.sh`, signed with release keys)
- [ ] Outside security review
- [ ] Complete user and developer docs (AEC-01 added ABI, memory map,
  threat model, rule registry and evidence matrix)

## Panini sandhi

- [x] Vowel, visarga and hal sandhi, rules 1–31, in the library and the
  capsule ([rule registry](../docs/PANINI_RULE_REGISTRY.md))
- [x] Rules 32–34 and duals with caller `Hints` (library only)
- [ ] Hints in the capsule or the wire format
