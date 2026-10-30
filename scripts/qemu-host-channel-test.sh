#!/bin/bash
# QEMU test for the host channel (src/hostlink.rs, crates/maataa-link).
# QEMU's USART2 is the second -serial device, exposed as a Unix socket. QEMU
# waits for the host tool to connect before it starts the guest, so the
# kernel's HELLO frame is never lost. The tool then runs its selftest: PING
# (text and binary), STATUS, TELEMETRY, INFO, a corrupted frame and an unknown
# request (both must be rejected), and a final PING.
# Exit status is the selftest's (0 pass); a hang fails after 60 s.
set -euo pipefail

TARGET=thumbv7em-none-eabihf
BIN=target/$TARGET/release/maataa-os

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

RUSTC="${RUSTC:-$(rustup which rustc)}" cargo build --release --target "$TARGET"
cargo build --release -p maataa-link --features cli
TOOL=target/release/maataa-link

WORK="$(mktemp -d)"
SOCK="$WORK/hostlink.sock"
QEMU_LOG="$WORK/qemu.log"
QEMU_PID=""
cleanup() {
    if [ -n "$QEMU_PID" ] && kill -0 "$QEMU_PID" 2>/dev/null; then
        kill "$QEMU_PID" 2>/dev/null || true
    fi
    rm -rf "$WORK"
}
trap cleanup EXIT

run_with_limit 60 qemu-system-arm \
    -machine netduinoplus2 \
    -cpu cortex-m4 \
    -kernel "$BIN" \
    -nographic \
    -monitor none \
    -semihosting-config enable=on,target=native \
    -serial null \
    -chardev "socket,id=hostlink,path=$SOCK,server=on,wait=on" \
    -serial chardev:hostlink \
    >"$QEMU_LOG" 2>&1 &
QEMU_PID=$!

status=0
run_with_limit 30 "$TOOL" --qemu-socket "$SOCK" --require-hello --timeout-ms 3000 selftest || status=$?
wait "$QEMU_PID" || true
QEMU_PID=""

if ! grep -q '^host channel: ready on USART2' "$QEMU_LOG"; then
    echo "FAIL: the kernel did not report the host channel ready" >&2
    status=1
fi
if [ "$status" -ne 0 ]; then
    echo "--- QEMU output ---" >&2
    cat "$QEMU_LOG" >&2
fi
exit "$status"
