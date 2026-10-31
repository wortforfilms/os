#!/bin/bash
set -Eeuo pipefail

TARGET=thumbv7em-none-eabihf
RUSTC="$(rustup which rustc)"
RUSTDOC="$(rustup which rustdoc)"
export RUSTC
export RUSTDOC
DONE=0
TOTAL=10
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
    trap - EXIT
    exit "$status"
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
F411_TREE="$(cargo tree --target "$TARGET" --no-default-features --features board-f411)"
if printf '%s\n' "$F411_TREE" | rg -qi semihost; then
    echo "FAIL: board-f411 dependency tree contains semihosting" >&2
    exit 1
fi
if ! printf '%s\n' "$F411_TREE" | rg -q 'stm32f4xx-hal v'; then
    echo "FAIL: board-f411 dependency tree does not include stm32f4xx-hal" >&2
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
cargo test -p maataa-link -p maataa-capsule -p maataa-wasm -p hemant-core
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
rg -q '^capsule memory: [0-9]+/[0-9]+ bytes$' "$BOOT_LOG"
rg -q '^telemetry capsule id: ' "$BOOT_LOG"
rg -q '^control capsule id: ' "$BOOT_LOG"
rg -q '^clock: systick 1000 Hz, core ' "$BOOT_LOG"
rg -q '^board: qemu-netduinoplus2-stm32f405$' "$BOOT_LOG"
rg -q '^time: kernel-monotonic-since-boot$' "$BOOT_LOG"
rg -q '^sched: round-robin tasks=7 first_switch_at_ms=([1-9]|1[0-9]|20)$' "$BOOT_LOG"
[ "$(rg -c '^sched:' "$BOOT_LOG")" -eq 1 ]
rg -q '^uptime ns: [0-9]+$' "$BOOT_LOG"
rg -q '^hemant anchor: host-unix-clock-unverified$' "$BOOT_LOG"
rg -q '^hemant ns since epoch: [0-9]+$' "$BOOT_LOG"
rg -q '^hemant position: ahoratra [0-9]+ muhurta [0-9]+ kala [0-9]+ kastha [0-9]+ nimesha [0-9]+$' "$BOOT_LOG"
rg -q '^capsule verified: telemetry caps=write,sleep$' "$BOOT_LOG"
rg -q '^capsule verified: hostlink caps=write,sleep,uart_write,uart_read,host_status$' "$BOOT_LOG"
if rg -q '^capsule rejected' "$BOOT_LOG"; then
    echo "FAIL: a built-in capsule was rejected" >&2
    exit 1
fi
rg -q '^capsule tamper check: rejected \(bad signature\)$' "$BOOT_LOG"
rg -q '^task 3: led without capability -> ENOCAP$' "$BOOT_LOG"
# Task 7 runs the signed telemetry capsule's WebAssembly; its manifest has no
# LED capability, so its LED import must be refused.
rg -q '^capsule telemetry: wasm loaded ' "$BOOT_LOG"
rg -q '^capsule telemetry: init -> -16 \(ENOCAP\)$' "$BOOT_LOG"
rg -q '^capsule telemetry: tick 3 -> 233 ' "$BOOT_LOG"
TASK_ORDER="$(rg '^task [123]$' "$BOOT_LOG" | head -n 3 | tr '\n' ' ')"
[ "$TASK_ORDER" = "task 1 task 2 task 3 " ]
pass

STEP="QEMU clock self-test"
./scripts/qemu-clock-test.sh
pass

STEP="QEMU host channel"
./scripts/qemu-host-channel-test.sh
pass
