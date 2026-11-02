#!/bin/bash
# QEMU test for installing a capsule at run time (src/installed.rs,
# docs/capsules.md). The capsule area is the host file
# target/qemu-capsule.bin, so an install survives into the next QEMU run.
#
#   run 1: install greeter (version 2): accepted
#   run 2: greeter runs as task 9; installing greeter version 1 is refused
#   run 3: greeter still runs; a tampered image is refused
#   run 3b: greeter version 3 is begun and written but never committed
#   run 4: greeter version 2 still runs; an image named like a built-in
#          capsule (heartbeat) is refused
#   run 5: capsule-info shows greeter version 2; then it is removed
#   run 6: no capsule installed, task 9 not started
# Exit status 0 on pass; a hang fails after 60 s per run.
set -euo pipefail

TARGET=thumbv7em-none-eabihf
BIN=target/$TARGET/release/maataa-os
TOOL=target/release/maataa-link
SIGN=target/release/maataa-capsule
AREA_FILE=target/qemu-capsule.bin

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
cargo build --release -p maataa-capsule --features cli

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
# QEMU to finish, and leaves the kernel log in $WORK/run.log and the tool's
# output in $WORK/tool.log. Returns the tool's exit status.
boot_and_talk() {
    local sock="$WORK/hostlink.sock"
    rm -f "$sock"
    run_with_limit 60 qemu-system-arm -machine netduinoplus2 -cpu cortex-m4 -kernel "$BIN" \
        -nographic -monitor none -semihosting-config enable=on,target=native \
        -serial null -chardev "socket,id=hostlink,path=$sock,server=on,wait=on" \
        -serial chardev:hostlink >"$WORK/run.log" 2>&1 &
    QEMU_PID=$!
    local status=0
    run_with_limit 30 "$TOOL" --qemu-socket "$sock" --require-hello --timeout-ms 5000 "$@" \
        >"$WORK/tool.log" 2>&1 || status=$?
    wait "$QEMU_PID" || true
    QEMU_PID=""
    cat "$WORK/tool.log"
    return "$status"
}

fail() {
    echo "FAIL: $1" >&2
    echo "--- kernel log ---" >&2
    cat "$WORK/run.log" >&2
    exit 1
}

log_has() { grep -q "$1" "$WORK/run.log"; }

# The images: greeter version 2 (assets), version 1 built from the same
# source, a tampered copy, and the built-in heartbeat image.
GREETER=assets/capsules/greeter.mcap
sed 's/version=2/version=1/' capsules/greeter.wat >"$WORK/greeter-v1.wat"
"$SIGN" wasm "$WORK/greeter-v1.wat" -o "$WORK/greeter-v1.wasm" >/dev/null
"$SIGN" sign --name greeter --caps write,sleep --payload "$WORK/greeter-v1.wasm" --dev \
    -o "$WORK/greeter-v1.mcap" >/dev/null
# Version 3 for the unfinished install: newer, so it would win if the kernel
# took a half-written image.
sed 's/version=2/version=3/' capsules/greeter.wat >"$WORK/greeter-v3.wat"
"$SIGN" wasm "$WORK/greeter-v3.wat" -o "$WORK/greeter-v3.wasm" >/dev/null
"$SIGN" sign --name greeter --caps write,sleep --payload "$WORK/greeter-v3.wasm" --dev \
    -o "$WORK/greeter-v3.mcap" >/dev/null
python3 - "$GREETER" "$WORK/tampered.mcap" <<'PY'
import sys
data = bytearray(open(sys.argv[1], "rb").read())
data[40] ^= 0x01  # a payload byte
open(sys.argv[2], "wb").write(data)
PY

rm -f "$AREA_FILE"

boot_and_talk capsule-install "$GREETER" || fail "run 1: install"
log_has '^capsule installed: none$' || fail "run 1: area was not empty"
log_has '^capsule install: greeter version 2 accepted; it runs from the next boot$' \
    || fail "run 1: kernel did not accept greeter"

if boot_and_talk capsule-install "$WORK/greeter-v1.mcap"; then
    fail "run 2: an older version was installed"
fi
log_has '^capsule installed: greeter version 2 caps=write,sleep$' || fail "run 2: greeter not found at boot"
log_has '^capsule task 9: greeter (priority 1)$' || fail "run 2: greeter has no task"
log_has '^capsule greeter: greeter capsule up$' || fail "run 2: greeter did not run"
log_has '^capsule greeter: schedule: 2 ticks every 100 ms (signed manifest)$' || fail "run 2: schedule"
log_has '^capsule greeter: tick 2 -> 102 ' || fail "run 2: greeter did not tick twice"
log_has '^capsule install: refused: older than version 2 already installed$' \
    || fail "run 2: downgrade not refused as older"

if boot_and_talk capsule-install "$WORK/tampered.mcap"; then
    fail "run 3: a tampered image was installed"
fi
log_has '^capsule task 9: greeter (priority 1)$' || fail "run 3: the refused install removed greeter"
log_has '^capsule install: refused: bad signature$' || fail "run 3: tamper not refused for its signature"

# An install cut off after begin and write, with no commit (a lost cable):
# the next boot must still run the installed greeter version 2.
boot_and_talk capsule-install-no-commit "$WORK/greeter-v3.mcap" || fail "run 3b: unfinished install"

if boot_and_talk capsule-install assets/capsules/heartbeat.mcap; then
    fail "run 4: a built-in name was installed"
fi
log_has '^capsule installed: greeter version 2 caps=write,sleep$' \
    || fail "run 4: an unfinished install replaced greeter version 2"
log_has '^capsule task 9: greeter (priority 1)$' || fail "run 4: greeter has no task after an unfinished install"
log_has '^capsule install: refused: the name of a built-in capsule$' || fail "run 4: built-in name"

boot_and_talk capsule-info || fail "run 5: info"
grep -q '^installed: greeter version 2, 293 bytes, caps write,sleep$' "$WORK/tool.log" \
    || fail "run 5: capsule-info"
boot_and_talk capsule-remove || fail "run 5b: remove"

boot_and_talk capsule-info || fail "run 6: info"
grep -q '^no capsule installed$' "$WORK/tool.log" || fail "run 6: still installed"
log_has '^capsule installed: none$' || fail "run 6: kernel still found a capsule"
if log_has '^capsule task 9'; then
    fail "run 6: task 9 started without a capsule"
fi
rm -f "$AREA_FILE"
echo "PASS: run-time capsule install (accepted, ran as task 9, downgrade/tamper/built-in name refused, unfinished install ignored, removed)"
