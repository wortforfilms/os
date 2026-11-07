#!/bin/bash
# Board test for a NUCLEO-F411RE (or, with BOARD=f446, a NUCLEO-F446RE) on
# the ST-LINK: build the kernel for that board,
# flash it with probe-rs (download, then reset: never a killed `run`), wait
# for the host channel, then run the host-channel selftest, STATUS, kernel
# key 3 (starvation episodes), capsule-info and 10 pings.
# Needs ST-LINK firmware V2J49M36 or newer: older firmware (V2J33M25) stalls
# the serial port after every probe-rs operation until a USB replug.
# Keeps the Mac awake while it runs: when the Mac sleeps, the ST-LINK resets
# the board (seen 2026-11-03, docs/EVIDENCE_MATRIX.md).
# Exit status 0 only if every step passed. Log: target/board-test.txt
set -euo pipefail
cd "$(dirname "$0")/.."

BOARD="${BOARD:-f411}"
case "$BOARD" in
    f411) DEFAULT_CHIP=STM32F411RETx ;;
    f446) DEFAULT_CHIP=STM32F446RETx ;;
    *) echo "BOARD must be f411 or f446" >&2; exit 2 ;;
esac
CHIP="${PROBE_RS_CHIP:-$DEFAULT_CHIP}"
TARGET=thumbv7em-none-eabihf
OS_BIN="target/$TARGET/release/maataa-os"
LINK_BIN="target/release/maataa-link"
LOG=target/board-test.txt
mkdir -p target
: >"$LOG"
exec > >(tee "$LOG") 2>&1

step() { printf '\n== %s\n' "$1"; }
fail() { printf 'FAIL: %s\n' "$1"; exit 1; }

export RUSTC="$(rustup which rustc)"

step "board"
# caffeinate (macOS) ends by itself when this script exits.
if command -v caffeinate >/dev/null; then
    caffeinate -dimsu -w $$ &
    echo "keeping the Mac awake (caffeinate)"
fi
PORT="${MAATAA_SERIAL:-$(ls /dev/cu.usbmodem* 2>/dev/null | head -n 1)}"
[ -n "$PORT" ] || fail "no /dev/cu.usbmodem* port: is the Nucleo plugged in?"
echo "port: $PORT"
if pgrep -x probe-rs >/dev/null; then
    fail "another probe-rs holds the ST-LINK; close it first"
fi
cat /Volumes/NOD_*/DETAILS.TXT 2>/dev/null | head -n 1 || true

step "build"
# The kernel needs the ARM target and the board feature: a plain
# `cargo build` would build the QEMU board for the host, and the flash step
# would then pick up an old ELF.
rm -f "$OS_BIN"
cargo build --release --target "$TARGET" --no-default-features --features "board-$BOARD" --bin maataa-os
cargo build --release -p maataa-link --features cli
[ -f "$OS_BIN" ] || fail "kernel ELF missing after the build"

step "flash"
# One retry: on 2026-11-01 the first download after the ST-LINK update failed
# with a USB endpoint stall while erasing sector 2; the next one passed. A
# download rewrites the whole kernel, so retrying it is safe.
if ! probe-rs download --chip "$CHIP" "$OS_BIN"; then
    echo "flash failed; retrying once in 3 s"
    sleep 3
    probe-rs download --chip "$CHIP" "$OS_BIN" || fail "flash failed twice"
fi
probe-rs reset --chip "$CHIP"

LINK=("$LINK_BIN" --serial "$PORT" --timeout-ms 3000)

step "wait for the host channel (up to 15 s)"
ready=0
for _ in $(seq 1 15); do
    if "${LINK[@]}" ping boot >/dev/null 2>&1; then ready=1; break; fi
    sleep 1
done
[ "$ready" -eq 1 ] || fail "no reply on $PORT within 15 s of the reset"
echo "host channel up"

step "selftest";      "${LINK[@]}" selftest
step "status";        "${LINK[@]}" status
step "kernel key 3 (starvation episodes)"; "${LINK[@]}" get 3
step "capsule-info";  "${LINK[@]}" capsule-info || echo "(no run-time capsule installed)"

step "10 pings"
for i in $(seq 1 10); do "${LINK[@]}" ping "p$i"; done

printf '\nPASS: board test (%s, %s)\n' "$CHIP" "$PORT"
