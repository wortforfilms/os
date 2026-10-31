#!/bin/bash
# QEMU test for the store's rollback counter (feature otp-rollback,
# crates/maataa-store/src/rollback.rs). The "OTP" is the host file
# target/qemu-otp.bin; it is built in its own target directory so the normal
# build is untouched.
#
#   run 1: fresh store and OTP; key 30 = "before"; keep a copy of the flash
#   run 2: 260 writes force a compaction: generation and counter reach 2
#   run 3: the copy from run 1 is put back: mount refuses it (rolled back)
#   run 4: the current flash is put back: it mounts, key 30 reads back
# Exit status 0 on pass; a hang fails after 60 s per run.
set -euo pipefail

TARGET=thumbv7em-none-eabihf
DIR=target/otp-rollback
BIN=$DIR/$TARGET/release/maataa-os
TOOL=target/release/maataa-link
FLASH_FILE=target/qemu-flash.bin
OTP_FILE=target/qemu-otp.bin

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

RUSTC="${RUSTC:-$(rustup which rustc)}" cargo build --release --target "$TARGET" \
    --features otp-rollback --target-dir "$DIR"
cargo build --release -p maataa-link --features cli

WORK="$(mktemp -d)"
QEMU_PID=""
cleanup() {
    if [ -n "$QEMU_PID" ] && kill -0 "$QEMU_PID" 2>/dev/null; then
        kill "$QEMU_PID" 2>/dev/null || true
    fi
    rm -rf "$WORK"
    rm -f "$OTP_FILE"
}
trap cleanup EXIT

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

log_has() { grep -q "$1" "$WORK/run.log"; }

rm -f "$FLASH_FILE" "$OTP_FILE"

boot_and_talk put 30 before || fail "run 1: put"
log_has '^flash store: rollback counter 1/256 (one-time programmable)$' || fail "run 1: counter is not 1"
cp "$FLASH_FILE" "$WORK/old-flash.bin"

boot_and_talk store-stress 260 || fail "run 2: store-stress"
cp "$FLASH_FILE" "$WORK/new-flash.bin"

cp "$WORK/old-flash.bin" "$FLASH_FILE"
boot_and_talk info || fail "run 3: info"
log_has '^flash store: not mounted: rolled back to an older copy$' || fail "run 3: rollback not refused"

cp "$WORK/new-flash.bin" "$FLASH_FILE"
out="$(boot_and_talk get 30)" || fail "run 4: get"
echo "$out"
echo "$out" | grep -q '"before"' || fail "run 4: key 30 did not read back"
counter="$(sed -n 's|^flash store: rollback counter \([0-9]*\)/256 .*|\1|p' "$WORK/run.log")"
[ "${counter:-0}" -ge 2 ] || fail "run 4: counter did not advance (${counter:-?})"
rm -f "$FLASH_FILE"
echo "PASS: rollback counter (old flash copy refused at counter $counter; current copy mounts)"
