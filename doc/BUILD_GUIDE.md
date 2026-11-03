# Maataa OS Build Guide

How to build, test and run Maataa OS at `v0.1.0-alpha.8`, in QEMU and on a
NUCLEO-F411RE.

## Prerequisites

- Rust stable. `rust-toolchain.toml` adds the targets
  (`thumbv7em-none-eabihf`) and `rust-src`, `clippy`, `rustfmt` on first use.
- `qemu-system-arm` (QEMU `netduinoplus2` machine).
- `arm-none-eabi-size` (binutils) and `ripgrep` for the smoke and size checks.
- For the board: `probe-rs`, and ST-LINK firmware V2J49M36 or newer
  (older firmware stalls the serial port after every probe operation).

```bash
# macOS
brew install qemu arm-none-eabi-binutils ripgrep
cargo install probe-rs-tools --locked
# Debian / Ubuntu (as in CI)
sudo apt-get install -y qemu-system-arm binutils-arm-none-eabi ripgrep
```

## Boards

The board is a Cargo feature; exactly one must be on.

| Feature | Board | Build |
| --- | --- | --- |
| `board-qemu-f405` (default) | QEMU `netduinoplus2` (STM32F405 model) | `cargo build --release --target thumbv7em-none-eabihf` |
| `board-f411` | NUCLEO-F411RE (STM32F411RET6) | add `--no-default-features --features board-f411` |

A plain `cargo build` for the host does not build the kernel; always pass
`--target thumbv7em-none-eabihf`.

## QEMU

```bash
./scripts/run.sh            # build and boot; the demo ends itself through semihosting
./scripts/smoke-alpha.sh    # release gate: 15 checks, one PASS/FAIL line (about 5 min)
./scripts/sizecheck.sh      # all four kernels (F411, QEMU; release, debug) within 128 KiB
```

`smoke-alpha.sh` runs, in order: both board builds, the semihosting check of
the F411 dependency tree, the host tests, the release build, the size check,
the QEMU boot report, and the QEMU tests for the clock, host channel, store,
run-time capsule install, rollback counter, priority inheritance and the
panini capsule ([EVIDENCE_MATRIX.md](../docs/EVIDENCE_MATRIX.md)).

## Host tests

```bash
./scripts/test-host.sh                       # the kernel's host tests (cargo test --lib)
cargo test -p maataa-link -p maataa-capsule -p maataa-wasm -p maataa-store -p hemant-core -p maataa-sandhi
cargo test -p maataa-sandhi --features alloc
```

CI (`.github/workflows/verify.yml`) also runs `cargo fmt --check` and clippy
with warnings as errors on the host crates and on eight kernel feature sets.

`./scripts/check-docs.py` checks that the docs still say what the code does:
the version, the number of smoke checks, the SVC call and error tables and
limits in `docs/ABI_SVC.md`, and the table in `docs/size.md` (with
`--sizes FILE`, against the output of `sizecheck.sh`; a build more than
2 KB away from the table fails). CI runs it; any `DRIFT:` line is a doc to
fix (or a code change the docs have not caught up with).

## Host tools

```bash
cargo build --release -p maataa-link --features cli      # host channel tool
cargo build --release -p maataa-capsule --features cli   # build and sign capsules
```

## NUCLEO-F411RE

The F411 kernel logs over USART2, the ST-LINK virtual COM port
(`/dev/cu.usbmodem*` on macOS, 115200 8-N-1). There is no RTT.

```bash
./scripts/board-test.sh    # build, flash (probe-rs download + reset), host-channel checks
target/release/maataa-link --serial /dev/cu.usbmodem11403 status
```

On macOS the `.command` files in the repository root run the board steps by
double-click: `Board test.command` (flash the normal kernel and check it),
`Board capsule install.command`, `Board host channel.command`,
`Board persistence check.command`, `Board power cut test.command`,
`Board inversion test.command` (priority inheritance, two test kernels,
then the normal kernel again), `Board watchdog test.command`,
`Flash kernel stack test.command`, `Nucleo reset check.command`. Keep the
Mac awake while they run (they use `caffeinate`): when it sleeps, the
ST-LINK resets the board.

Flashing a kernel rewrites only sectors 0–4, so the run-time capsule
(sector 5) and the store (sectors 6–7) stay. `probe-rs erase` clears them.

`scripts/run-hw.sh` builds the F411 kernel and runs it with `probe-rs run`;
it defaults to the Black Pill (`STM32F411CEUx`), so for the Nucleo set
`PROBE_RS_CHIP=STM32F411RETx`, or use `board-test.sh`.

## Release builds

`./scripts/release.sh` builds the F411 kernel with release keys from
`~/.maataa`, after the release commit and before the tag. See
[release.md](../docs/release.md).
