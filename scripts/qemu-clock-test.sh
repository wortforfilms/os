#!/bin/bash
# QEMU self-test for the kernel clock (src/clock.rs, src/bin/clock_selftest.rs).
# Checks: starts at 0, advances, monotonic, a pending wrap is counted, the rate
# is within 50..200% of the host wall clock (80..125% reported), Hemant
# time = anchor + uptime.
# Exit status is the self-test's own (0 pass, 1 fail); a hang fails after 60 s.
set -euo pipefail

TARGET=thumbv7em-none-eabihf
BIN=target/$TARGET/release/clock_selftest

# macOS has no `timeout`; use GNU timeout when present, else perl's alarm.
run_with_limit() {
    local seconds=$1; shift
    if command -v timeout >/dev/null 2>&1; then
        timeout "$seconds" "$@"
    elif command -v gtimeout >/dev/null 2>&1; then
        gtimeout "$seconds" "$@"
    else
        perl -e 'alarm shift; exec @ARGV or die "exec failed: $!"' "$seconds" "$@"
    fi
}

cargo build --release --target "$TARGET" --bin clock_selftest
qemu-system-arm --version | head -1
run_with_limit 60 qemu-system-arm \
    -machine netduinoplus2 \
    -cpu cortex-m4 \
    -kernel "$BIN" \
    -nographic \
    -semihosting-config enable=on,target=native
