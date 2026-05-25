# Maataa OS Roadmap

## Phase 1: QEMU Alpha

- [x] Parseable Cargo manifest
- [x] Cortex-M `no_std` boot path
- [x] QEMU semihosting boot logs
- [x] Virtual driver registry
- [x] Virtual storage manifest
- [x] Static capsule table
- [x] Scheduler simulation
- [x] Host unit tests for virtual subsystems
- [x] Size check script
- [x] Release smoke script

## Phase 2: Hardware Alpha

- [ ] Confirm target board and chip package
- [ ] Real clock and reset setup
- [ ] UART logging on hardware
- [ ] GPIO output smoke
- [ ] Hardware timer driver
- [ ] Flashing workflow validated with `probe-rs`
- [ ] Board-specific panic and fault reporting

## Phase 3: Storage And Capsules

- [ ] Flash abstraction
- [ ] LittleFS integration
- [ ] Capsule metadata format
- [ ] WASM module loading
- [ ] WASM imports for log, time, delay, and GPIO
- [ ] Capsule lifecycle state machine

## Phase 4: Security Model

- [ ] Capability descriptors
- [ ] Capsule signing and verification
- [ ] Memory isolation strategy
- [ ] System-call policy checks
- [ ] Fault containment

## Phase 5: Production Readiness

- [ ] CI smoke checks
- [ ] Hardware test matrix
- [ ] Release artifacts
- [ ] Security review
- [ ] Complete user and developer docs
