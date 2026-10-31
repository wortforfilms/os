#!/bin/bash
# QEMU test for the persistent store (crates/maataa-store,
# src/storage/persist.rs). In QEMU the two flash banks live in the host file
# target/qemu-flash.bin (through semihosting), so values must survive from
# one QEMU run to the next.
#
#   run 1: fresh file -> "boot count: 1"; the host writes key 30
#   run 2: "boot count: 2"; 260 writes to key 63 force a compaction
#   run 3: "boot count: 3"; key 30 reads back, a compaction happened, and the
#          WebAssembly telemetry capsule's own counter (key 32) reached 9
# Exit status 0 on pass; a hang fails after 60 s per run.
set -euo pipefail

TARGET=thumbv7em-none-eabihf
BIN=target/$TARGET/release/maataa-os
TOOL=target/release/maataa-link
FLASH_FILE=target/qemu-flash.bin

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

WORK="$(mktemp -d)"
QEMU_PID=""
cleanup() {
    if [ -n "$QEMU_PID" ] && kill -0 "$QEMU_PID" 2>/dev/null; then
        kill "$QEMU_PID" 2>/dev/null || true
    fi
    rm -rf "$WORK"
}
trap cleanup EXIT

# Starts QEMU with USART2 on a socket, runs the host tool with "$@", waits for
# QEMU to finish, and leaves the kernel log in $WORK/run.log.
boot_and_talk() {
    local sock="$WORK/hostlink.sock"
    rm -f "$sock"
    run_with_limit 60 qemu-system-arm -machine netduinoplus2 -cpu cortex-m4 -kernel "$BIN" \
        -nographic -monitor none -semihosting-config enable=on,target=native \
        -serial null -chardev "socket,id=hostlink,path=$sock,server=on,wait=on" \
        -serial chardev:hostlink >"$WORK/run.log" 2>&1 &
    QEMU_PID=$!
    local status=0
    run_with_limit 30 "$TOOL" --qemu-socket "$sock" --require-hello --timeout-ms 5000 "$@" || status=$?
    wait "$QEMU_PID" || true
    QEMU_PID=""
    return "$status"
}

fail() {
    echo "FAIL: $1" >&2
    echo "--- kernel log ---" >&2
    cat "$WORK/run.log" >&2
    exit 1
}

rm -f "$FLASH_FILE"

boot_and_talk put 30 persisted-across-reboot || fail "run 1: put"
grep -q '^flash store: .*(formatted)$' "$WORK/run.log" || fail "run 1: store was not formatted"
grep -q '^boot count: 1$' "$WORK/run.log" || fail "run 1: boot count is not 1"

boot_and_talk store-stress 260 || fail "run 2: store-stress"
grep -q '^boot count: 2$' "$WORK/run.log" || fail "run 2: boot count is not 2"

out="$(boot_and_talk get 30)" || fail "run 3: get"
echo "$out"
echo "$out" | grep -q '"persisted-across-reboot"' || fail "run 3: key 30 did not survive"
grep -q '^boot count: 3$' "$WORK/run.log" || fail "run 3: boot count is not 3"
# The telemetry capsule keeps its lifetime tick count in key 32 through its
# own memory and imports: 3 ticks per boot, so 9 after the third boot.
grep -q '^capsule telemetry: log 9$' "$WORK/run.log" || fail "run 3: capsule lifetime count is not 9"
generation="$(sed -n 's/^flash store: bank [01] generation \([0-9]*\) .*/\1/p' "$WORK/run.log")"
[ "${generation:-0}" -ge 2 ] || fail "run 3: no compaction happened (generation ${generation:-?})"
echo "PASS: persistent store (3 boots, generation $generation after compaction)"
