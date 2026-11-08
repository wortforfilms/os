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
#   run 4b-4e: an unsigned commit, a commit signed with another key, an
#          unsigned remove and a replayed signed request are refused
#   run 5: capsule-info shows greeter version 2; then it is removed (signed)
#   run 6: no capsule installed, task 9 not started
#   runs 7-11: live readings (keys 54-59, docs/persistence.md). A stand-in
#          capsule signed as "modbus" writes flash key 48 and RAM key 54 and
#          is refused bms's key 52; the host reads key 54 but may not write
#          it, signed or not; after a reboot without the capsule, key 48 is
#          still there and key 54 is gone (RAM only). Run 11 deletes key 48.
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
# A stand-in for the modbus capsule (step 6 brings the real one): its init
# writes flash key 48 and RAM key 54, then returns its write to key 52
# (bms's), which the kernel must refuse with EPERM.
cat >"$WORK/modbus.wat" <<'WAT'
(module
  (@custom "maataa" "ticks=1 period_ms=100 version=1")
  (import "maataa" "store_put" (func $put (param i32 i32 i32) (result i32)))
  (memory 1)
  (data (i32.const 0) "flash-config")
  (data (i32.const 16) "live-reading")
  (data (i32.const 32) "intruder")
  (func (export "init") (result i32)
    i32.const 48 i32.const 0 i32.const 12 call $put drop
    i32.const 54 i32.const 16 i32.const 12 call $put drop
    i32.const 52 i32.const 32 i32.const 8 call $put)
  (func (export "tick") (result i32)
    i32.const 0))
WAT
"$SIGN" wasm "$WORK/modbus.wat" -o "$WORK/modbus.wasm" >/dev/null
"$SIGN" sign --name modbus --caps store_put --payload "$WORK/modbus.wasm" --dev \
    -o "$WORK/modbus.mcap" >/dev/null
python3 - "$GREETER" "$WORK/tampered.mcap" <<'PY'
import sys
data = bytearray(open(sys.argv[1], "rb").read())
data[40] ^= 0x01  # a payload byte
open(sys.argv[2], "wb").write(data)
PY

rm -f "$AREA_FILE"

boot_and_talk --dev capsule-install "$GREETER" || fail "run 1: install"
log_has '^capsule installed: none$' || fail "run 1: area was not empty"
log_has '^capsule install: greeter version 2 accepted; it runs from the next boot$' \
    || fail "run 1: kernel did not accept greeter"

if boot_and_talk --dev capsule-install "$WORK/greeter-v1.mcap"; then
    fail "run 2: an older version was installed"
fi
log_has '^capsule installed: greeter version 2 caps=write,sleep$' || fail "run 2: greeter not found at boot"
log_has '^capsule task 9: greeter (priority 1)$' || fail "run 2: greeter has no task"
log_has '^capsule greeter: greeter capsule up$' || fail "run 2: greeter did not run"
log_has '^capsule greeter: schedule: 2 ticks every 100 ms (signed manifest)$' || fail "run 2: schedule"
log_has '^capsule greeter: tick 2 -> 102 ' || fail "run 2: greeter did not tick twice"
log_has '^capsule install: refused: older than version 2 already installed$' \
    || fail "run 2: downgrade not refused as older"

if boot_and_talk --dev capsule-install "$WORK/tampered.mcap"; then
    fail "run 3: a tampered image was installed"
fi
log_has '^capsule task 9: greeter (priority 1)$' || fail "run 3: the refused install removed greeter"
log_has '^capsule install: refused: bad signature$' || fail "run 3: tamper not refused for its signature"

# An install cut off after begin and write, with no commit (a lost cable):
# the next boot must still run the installed greeter version 2.
boot_and_talk capsule-install-no-commit "$WORK/greeter-v3.mcap" || fail "run 3b: unfinished install"

if boot_and_talk --dev capsule-install assets/capsules/heartbeat.mcap; then
    fail "run 4: a built-in name was installed"
fi
log_has '^capsule installed: greeter version 2 caps=write,sleep$' \
    || fail "run 4: an unfinished install replaced greeter version 2"
log_has '^capsule task 9: greeter (priority 1)$' || fail "run 4: greeter has no task after an unfinished install"
log_has '^capsule install: refused: the name of a built-in capsule$' || fail "run 4: built-in name"

# Signed host requests (docs/SECURITY_DESIGN.md, Part A). Greeter version 3
# would be accepted by its signature and version; it must still be refused
# when the commit is not signed, or signed with another key, and greeter
# version 2 must keep running.
if boot_and_talk capsule-install "$WORK/greeter-v3.mcap"; then
    fail "run 4b: an unsigned commit installed greeter version 3"
fi
log_has '^capsule install: refused: commit and remove need a signed request$' \
    || fail "run 4b: unsigned commit not refused as such"
head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' >"$WORK/other.seed"
if boot_and_talk --seed-file "$WORK/other.seed" capsule-install "$WORK/greeter-v3.mcap"; then
    fail "run 4c: a commit signed with another key was accepted"
fi
log_has '^capsule task 9: greeter (priority 1)$' || fail "run 4c: greeter version 2 no longer runs"
log_has '^host request: refused: bad signature, or not for this board and challenge$' \
    || fail "run 4c: the wrong key was not refused as a bad signature"
if boot_and_talk capsule-remove; then
    fail "run 4d: an unsigned remove was accepted"
fi
boot_and_talk --dev signed-replay-test || fail "run 4e: a replayed signed request was not refused"
grep -q '^signed request accepted once, refused when replayed$' "$WORK/tool.log" || fail "run 4e: replay"

boot_and_talk capsule-info || fail "run 5: info"
grep -q '^installed: greeter version 2, 293 bytes, caps write,sleep$' "$WORK/tool.log" \
    || fail "run 5: capsule-info"
boot_and_talk --dev capsule-remove || fail "run 5b: remove"

boot_and_talk capsule-info || fail "run 6: info"
grep -q '^no capsule installed$' "$WORK/tool.log" || fail "run 6: still installed"
log_has '^capsule installed: none$' || fail "run 6: kernel still found a capsule"
if log_has '^capsule task 9'; then
    fail "run 6: task 9 started without a capsule"
fi

# Live readings: RAM-only keys 54-59 (docs/persistence.md).
boot_and_talk --dev capsule-install "$WORK/modbus.mcap" || fail "run 7: install modbus stand-in"
log_has '^capsule install: modbus version 1 accepted; it runs from the next boot$' \
    || fail "run 7: modbus stand-in not accepted"

boot_and_talk get 54 || fail "run 8: get key 54"
grep -q '^key 54: "live-reading" (12 bytes)$' "$WORK/tool.log" || fail "run 8: key 54 does not hold the live reading"
log_has '^capsule modbus: init -> -1 (EPERM)$' || fail "run 8: modbus wrote bms's key 52"
if boot_and_talk put 54 intruder; then
    fail "run 8b: the host channel wrote RAM key 54"
fi
if boot_and_talk --dev put-signed 54 intruder; then
    fail "run 8c: a signed host request wrote RAM key 54"
fi
boot_and_talk --dev capsule-remove || fail "run 8d: remove the modbus stand-in"

boot_and_talk get 48 || fail "run 9: get key 48"
grep -q '^key 48: "flash-config" (12 bytes)$' "$WORK/tool.log" || fail "run 9: flash key 48 did not survive the reboot"
if boot_and_talk get 54; then
    fail "run 10: RAM key 54 survived a reboot"
fi
grep -q 'key not found' "$WORK/tool.log" || fail "run 10: key 54 not reported as not found"

boot_and_talk --dev put-signed 48 || fail "run 11: delete key 48 (signed)"
if boot_and_talk get 48; then
    fail "run 11: key 48 was not deleted"
fi

rm -f "$AREA_FILE"
echo "PASS: run-time capsule install (accepted, ran as task 9, downgrade/tamper/built-in name refused, unfinished install ignored, unsigned/wrong-key/replayed requests refused, removed; live keys 54-59 in RAM only, owner-only)"
