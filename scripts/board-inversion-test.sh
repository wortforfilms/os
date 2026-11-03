#!/bin/bash
# Priority inheritance on a NUCLEO-F411RE: the board version of
# scripts/qemu-inversion-test.sh (smoke check 14). Tasks 1-3 act out a
# priority inversion: L (level 1) holds mutex 1 for 40 M cycles (0.4 s at
# 100 MHz), H (level 3) waits for it, M (level 2) computes for 300 M cycles
# (3 s). Two kernels, flashed one after the other:
#   - inheritance on: H gets the lock before M is done, and the starvation
#     monitor never reports L while it holds the lock;
#   - built with pi-off: M finishes first, the monitor reports task 1 (L)
#     ready for 1000 ms without running while it holds the lock, and kernel
#     key 3 counts it.
# The kernel log comes over USART2 (the ST-LINK virtual COM port); each
# kernel is recorded for 15 s after its reset. At the end the normal dev
# kernel (the one Board test.command flashes) goes back on the board and the
# host channel must answer. The store and the installed capsule are not
# touched: the test kernels only read kernel key 3.
#
#   ./scripts/board-inversion-test.sh        (Board inversion test.command)
#
# Close any serial terminal on the port first. Log: target/board-inversion.txt
# (raw serial: target/board-inversion-on.raw, target/board-inversion-off.raw).
# Exit status 0 only if both runs passed and the normal kernel is back.
set -u
cd "$(dirname "$0")/.."
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
# The serial log holds COBS frames as well as text: read it as bytes.
export LC_ALL=C
# Keep the Mac awake: when it sleeps the ST-LINK resets the board.
command -v caffeinate >/dev/null && caffeinate -dimsu -w $$ &

CHIP="${PROBE_RS_CHIP:-STM32F411RETx}"
TARGET=thumbv7em-none-eabihf
LOG=target/board-inversion.txt
RECORD_S=15
mkdir -p target
: >"$LOG"
say() { echo "$@" | tee -a "$LOG"; }
failed=0
bad() { say "FAIL: $*"; failed=1; }
RUSTC="$(rustup which rustc 2>/dev/null || command -v rustc)"
export RUSTC

PORT="${MAATAA_SERIAL:-$(ls /dev/cu.usbmodem* 2>/dev/null | head -n 1)}"
[ -n "$PORT" ] || { say "FAIL: no /dev/cu.usbmodem* port: is the Nucleo plugged in?"; exit 1; }
if pgrep -x probe-rs >/dev/null; then
    say "FAIL: another probe-rs holds the ST-LINK; close it first"
    exit 1
fi
say "$(date); port $PORT; chip $CHIP"

say "building the two test kernels and the normal kernel ..."
# All three in the usual target directory (only the kernel crate is rebuilt
# between them, so no second copy of the dependencies); each ELF is copied
# out before the next build replaces it.
ELF="target/$TARGET/release/maataa-os"
ON=target/board-inversion-on.elf
OFF=target/board-inversion-off.elf
NORMAL=target/board-inversion-normal.elf
build() { # features, copy to
    rm -f "$ELF"
    cargo build -q --release --target "$TARGET" --no-default-features \
        --features "$1" --bin maataa-os && cp "$ELF" "$2"
}
build board-f411,inversion-test "$ON" || { say "FAIL: build (inversion-test)"; exit 1; }
build board-f411,inversion-test,pi-off "$OFF" || { say "FAIL: build (pi-off)"; exit 1; }
build board-f411 "$NORMAL" || { say "FAIL: build (normal kernel)"; exit 1; }
cargo build -q --release -p maataa-link --features cli || { say "FAIL: build (maataa-link)"; exit 1; }

flash() { # ELF
    if ! probe-rs download --chip "$CHIP" "$1" >/dev/null 2>&1; then
        sleep 3
        probe-rs download --chip "$CHIP" "$1" >/dev/null 2>&1 || return 1
    fi
    probe-rs reset --chip "$CHIP" >/dev/null 2>&1
}

# Flash an ELF while recording the serial port; leaves the inversion and
# starvation lines in $2.events.
record() { # ELF, raw file
    exec 3<>"$PORT"
    stty 115200 raw -echo cs8 -cstopb -parenb clocal <&3
    ( cat <&3 >"$2" ) &
    local cat_pid=$!
    if ! flash "$1"; then
        kill "$cat_pid" 2>/dev/null; wait "$cat_pid" 2>/dev/null; exec 3<&-
        return 1
    fi
    sleep "$RECORD_S"
    kill "$cat_pid" 2>/dev/null
    wait "$cat_pid" 2>/dev/null
    exec 3<&-
    tr -d '\000' <"$2" | tr '\r' '\n' | grep -a -E '^(inversion:|sched: task)' >"$2.events" || true
    sed 's/^/    /' "$2.events" | tee -a "$LOG"
}

# Line number of the first line matching $2 in file $1 (empty if none).
at() { grep -n -m1 -E "$2" "$1" | cut -d: -f1; }
# Task 1 (L) reported starving before line $2 (before H got the lock).
starved_holding() {
    awk -v h="$2" 'NR < h && /^sched: task 1 \(priority 1\) ready for 1000 ms without running$/ { found=1 } END { exit !found }' "$1"
}

say ""
say "== inheritance on"
if record "$ON" target/board-inversion-on.raw; then
    E=target/board-inversion-on.raw.events
    H=$(at "$E" '^inversion: H got mutex 1$'); M=$(at "$E" '^inversion: M done$')
    if [ -z "$H" ] || [ -z "$M" ]; then
        bad "inheritance on: the run did not finish (H got the lock: ${H:-no}, M done: ${M:-no})"
    elif [ "$H" -gt "$M" ]; then
        bad "inheritance on: H got the lock only after M finished"
    elif starved_holding "$E" "$H"; then
        bad "inheritance on: L starved while holding the lock"
    elif ! grep -q '^inversion: starvation episodes [0-9]' "$E"; then
        bad "inheritance on: kernel key 3 unreadable"
    else
        say "PASS: inheritance on: H got the lock before M finished; L never starved holding it"
    fi
else
    bad "inheritance on: flashing failed"
fi

say ""
say "== inheritance off (pi-off)"
if record "$OFF" target/board-inversion-off.raw; then
    E=target/board-inversion-off.raw.events
    H=$(at "$E" '^inversion: H got mutex 1$'); M=$(at "$E" '^inversion: M done$')
    if [ -z "$H" ] || [ -z "$M" ]; then
        bad "pi-off: the run did not finish (H got the lock: ${H:-no}, M done: ${M:-no})"
    elif [ "$M" -gt "$H" ]; then
        bad "pi-off: H got the lock before M finished (no inversion to compare with)"
    elif ! starved_holding "$E" "$H"; then
        bad "pi-off: the monitor did not report L starving while it held the lock"
    elif ! grep -q '^inversion: starvation episodes [1-9]' "$E"; then
        bad "pi-off: kernel key 3 did not count it"
    else
        say "PASS: pi-off: M finished first and L starved holding the lock (the inversion inheritance prevents)"
    fi
else
    bad "pi-off: flashing failed"
fi

say ""
say "== normal kernel back on the board"
if flash "$NORMAL"; then
    L=(target/release/maataa-link --serial "$PORT" --timeout-ms 3000)
    back=0
    for _ in $(seq 1 15); do
        if "${L[@]}" ping back >/dev/null 2>&1; then back=1; break; fi
        sleep 1
    done
    if [ "$back" -eq 1 ]; then
        "${L[@]}" boot-info 2>&1 | tee -a "$LOG"
        "${L[@]}" capsule-info 2>&1 | tee -a "$LOG" || true
    else
        bad "the normal kernel did not answer within 15 s; run Board test.command"
    fi
else
    bad "flashing the normal kernel failed; run Board test.command"
fi

say ""
if [ "$failed" -eq 0 ]; then
    say "PASS: board priority inheritance test"
    exit 0
fi
say "FAIL: board priority inheritance test"
exit 1
