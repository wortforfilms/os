#!/bin/bash
# QEMU test for priority inheritance (src/sched/mod.rs, src/main.rs mod
# inversion). Tasks 1-3 act out a priority inversion: L (level 1) holds mutex
# 1 while it works, H (level 3) waits for it, M (level 2) computes for a long
# time. Run twice:
#   - inheritance on: L runs at H's level, H gets the lock before M is done,
#     and L never starves while it holds the lock;
#   - built with pi-off: M runs first, the monitor reports task 1 (L) starved
#     while it holds the lock, and H gets the lock only after M is done.
# -icount with a fixed shift makes guest time follow the instruction count,
# so both runs are the same every time.
set -euo pipefail

TARGET=thumbv7em-none-eabihf
BIN=target/$TARGET/release/maataa-os
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

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

fail() { echo "FAIL: $*" >&2; exit 1; }

run() {
    local features=$1 log=$2
    rm -f target/qemu-capsule.bin
    RUSTC="$(rustup which rustc)" cargo build -q --release --target "$TARGET" --features "$features"
    run_with_limit 90 qemu-system-arm \
        -machine netduinoplus2 \
        -cpu cortex-m4 \
        -icount shift=3 \
        -kernel "$BIN" \
        -nographic \
        -semihosting-config enable=on,target=native \
        -serial mon:stdio </dev/null >"$log" 2>&1 || true
    tr -d '\r' <"$log" | grep -a -E '^(inversion:|sched: task)' >"$log.events" || true
    sed 's/^/    /' "$log.events"
}

# Line number of the first line matching $2 in file $1 (0 if none).
at() { grep -n -m1 -E "$2" "$1" | cut -d: -f1 || true; }

# The starvation report for task 1 that comes before H gets the lock: L
# starved while holding it. (After L unlocks, M starving level 1 is plain
# strict priority and is reported in both runs.)
starved_holding() { local h=$2; awk -v h="$h" 'NR < h && /^sched: task 1 \(priority 1\) ready for 1000 ms without running$/ { found=1 } END { exit !found }' "$1"; }

echo "--- inheritance on ---"
run inversion-test "$WORK/on.log"
E="$WORK/on.log.events"
H=$(at "$E" '^inversion: H got mutex 1$'); M=$(at "$E" '^inversion: M done$')
[ -n "$H" ] || fail "inheritance on: H never got the lock"
[ -n "$M" ] || fail "inheritance on: M never finished"
[ "$H" -lt "$M" ] || fail "inheritance on: H got the lock only after M finished"
starved_holding "$E" "$H" && fail "inheritance on: L starved while holding the lock"
grep -q '^inversion: starvation episodes [0-9]' "$E" || fail "inheritance on: kernel key 3 unreadable"

echo "--- inheritance off (pi-off) ---"
run inversion-test,pi-off "$WORK/off.log"
E="$WORK/off.log.events"
H=$(at "$E" '^inversion: H got mutex 1$'); M=$(at "$E" '^inversion: M done$')
[ -n "$H" ] && [ -n "$M" ] || fail "pi-off: the run did not finish"
[ "$M" -lt "$H" ] || fail "pi-off: H got the lock before M finished (no inversion to compare with)"
starved_holding "$E" "$H" || fail "pi-off: the monitor did not report L starving while it held the lock"
grep -q '^inversion: starvation episodes [1-9]' "$E" || fail "pi-off: kernel key 3 did not count it"

echo "PASS: priority inheritance (H before M with it; L starved holding the lock without it)"
