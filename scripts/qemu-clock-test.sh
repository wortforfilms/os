#!/bin/bash
# QEMU self-test for the kernel clock (src/clock.rs, src/bin/clock_selftest.rs).
# Checks: starts at 0, advances, monotonic, a pending wrap is counted, the rate
# is within 80..125% of the host wall clock, Hemant time = anchor + uptime.
# Exit status is the self-test's own (0 pass, 1 fail); a hang fails after 60 s.
set -euo pipefail

TARGET=thumbv7em-none-eabihf
BIN=target/$TARGET/release/clock_selftest

cargo build --release --target "$TARGET" --bin clock_selftest
timeout 60 qemu-system-arm \
    -machine netduinoplus2 \
    -cpu cortex-m4 \
    -kernel "$BIN" \
    -nographic \
    -semihosting-config enable=on,target=native
