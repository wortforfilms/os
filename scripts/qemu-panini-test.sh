#!/bin/bash
# QEMU test for the panini capsule (capsules/panini.wat, docs/panini.md):
# install it at run time, then ask it for vowel sandhi through the store and
# read the answers back over the host channel.
#
#   run 1: install panini; it runs as task 9 from the next boot
#   per word: one run puts the request in key 40 (a tick answers it in that
#   run, or else at the start of the next), another reads key 41 (a QEMU run
#   lasts about 3 s: the demo exits)
#   last: remove panini, delete keys 40 and 41
# Exit status 0 on pass.
set -euo pipefail

TARGET=thumbv7em-none-eabihf
BIN=target/$TARGET/release/maataa-os
TOOL=target/release/maataa-link
AREA_FILE=target/qemu-capsule.bin
PANINI=assets/capsules/panini.mcap

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

# One QEMU run with USART2 on a socket and one host-tool command.
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
    return "$status"
}

fail() {
    echo "FAIL: $1" >&2
    echo "--- tool ---" >&2; cat "$WORK/tool.log" >&2
    echo "--- kernel log ---" >&2; cat "$WORK/run.log" >&2
    exit 1
}

log_has() { tr -d '\r' <"$WORK/run.log" | grep -q "$1"; }

rm -f "$AREA_FILE"
boot_and_talk capsule-install "$PANINI" || fail "install"
log_has '^capsule install: panini version 1 accepted; it runs from the next boot$' \
    || fail "the kernel did not accept panini"

for pair in "deva+indra devendra 3" "iti+Adi ityAdi 5" "vane+atra vane'tra 7"; do
    read -r request answer rule <<<"$pair"
    boot_and_talk put 40 "$request" || fail "$request: put"
    log_has '^capsule task 9: panini (priority 1)$' || fail "panini has no task"
    # A tick usually answers in the same run; if the run ended first, the
    # first tick of the next one does.
    if ! log_has "^capsule panini: $answer\$"; then
        boot_and_talk hello || fail "$request: hello"
        log_has "^capsule panini: $answer\$" || fail "$request: not answered in the log"
    fi
    log_has "^capsule panini: tick [0-9]* -> $rule " || fail "$request: rule $rule not returned"
    boot_and_talk get 41 || fail "$request: get"
    grep -q "^key 41: \"$answer\"" "$WORK/tool.log" || fail "$request: key 41 is not $answer"
    echo "  $request -> $answer (rule $rule)"
done

boot_and_talk put 40 "deva+in+dra" || fail "malformed: put"
if ! log_has '^capsule panini: tick [0-9]* -> -103 '; then
    boot_and_talk hello || fail "malformed: hello"
    log_has '^capsule panini: tick [0-9]* -> -103 ' || fail "malformed request not refused"
fi
boot_and_talk get 41 || fail "malformed: get"
grep -q '^key 41: "?"' "$WORK/tool.log" || fail "malformed: key 41 is not ?"
echo "  deva+in+dra -> ? (-103, not SLP1)"

boot_and_talk capsule-remove || fail "remove"
boot_and_talk put 41 || fail "delete key 41"
rm -f "$AREA_FILE"
echo "PASS: panini capsule (sandhi answered through the store; malformed request refused)"
