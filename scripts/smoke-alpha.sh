#!/bin/bash
set -Eeuo pipefail

TARGET=thumbv7em-none-eabihf
RUSTC="$(rustup which rustc)"
RUSTDOC="$(rustup which rustdoc)"
export RUSTC
export RUSTDOC
DONE=0
TOTAL=9
STEP="startup"
BOOT_LOG="$(mktemp)"
DUAL_LOG="$(mktemp)"
cleanup() { rm -f "$BOOT_LOG" "$DUAL_LOG"; }
finish() {
    local status=$?
    cleanup
    if [ "$status" -eq 0 ]; then
        printf 'PASS: smoke-alpha (%s/%s checks)\n' "$DONE" "$TOTAL"
    else
        printf 'FAIL: smoke-alpha (%s/%s checks; step: %s)\n' "$DONE" "$TOTAL" "$STEP"
    fi
}
trap finish EXIT

pass() { DONE=$((DONE + 1)); }

STEP="F411 target build"
cargo build --target "$TARGET" --no-default-features --features board-f411
pass

STEP="default QEMU target build"
cargo build --target "$TARGET"
pass

STEP="F411 dependency tree excludes semihosting"
if cargo tree --target "$TARGET" --no-default-features --features board-f411 | rg -qi semihost; then
    echo "FAIL: board-f411 dependency tree contains semihosting" >&2
    exit 1
fi
pass

STEP="both-board features fail cleanly"
if cargo build --target "$TARGET" --no-default-features --features "board-qemu-f405 board-f411" >"$DUAL_LOG" 2>&1; then
    echo "FAIL: selecting both board features unexpectedly compiled" >&2
    exit 1
fi
if ! rg -q 'select exactly one board feature: board-qemu-f405 or board-f411' "$DUAL_LOG"; then
    cat "$DUAL_LOG" >&2
    echo "FAIL: dual-board build did not report the board selection compile_error" >&2
    exit 1
fi
if rg -qi 'linking with .* failed|undefined reference|linker .* failed' "$DUAL_LOG"; then
    cat "$DUAL_LOG" >&2
    echo "FAIL: dual-board build reached linker errors instead of a clean compile error" >&2
    exit 1
fi
pass

STEP="host unit tests"
cargo test
pass

STEP="release build"
cargo build --release --target "$TARGET"
pass

STEP="size check"
./scripts/sizecheck.sh
pass

STEP="QEMU boot and boot report"
./scripts/run.sh 2>&1 | tee "$BOOT_LOG"
rg -q '^Boot report$' "$BOOT_LOG"
rg -q '^drivers: [0-9]+/[0-9]+ ready$' "$BOOT_LOG"
rg -q '^storage mounted: (true|false)$' "$BOOT_LOG"
rg -q '^manifest: ' "$BOOT_LOG"
rg -q '^capsules loaded: [0-9]+$' "$BOOT_LOG"
rg -q '^clock: systick 1000 Hz, core ' "$BOOT_LOG"
rg -q '^board: qemu-netduinoplus2-stm32f405$' "$BOOT_LOG"
pass

STEP="QEMU clock self-test"
./scripts/qemu-clock-test.sh
pass
