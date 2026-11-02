#!/bin/bash
set -Eeuo pipefail

TARGET=thumbv7em-none-eabihf
RUSTC="$(rustup which rustc)"
RUSTDOC="$(rustup which rustdoc)"
export RUSTC
export RUSTDOC
DONE=0
TOTAL=15
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
cargo test -p maataa-link -p maataa-capsule -p maataa-wasm -p maataa-store -p hemant-core -p maataa-sandhi
cargo test -p maataa-sandhi --features alloc
pass

STEP="release build"
cargo build --release --target "$TARGET"
pass

STEP="size check"
./scripts/sizecheck.sh
pass

STEP="QEMU boot and boot report"
# No run-time capsule for this boot (the install test leaves none either).
rm -f target/qemu-capsule.bin
./scripts/run.sh 2>&1 | tee "$BOOT_LOG"
rg -q '^capsule installed: none$' "$BOOT_LOG"
rg -q '^flash store: rollback counter: off \(feature otp-rollback\)$' "$BOOT_LOG"
rg -q '^Boot report$' "$BOOT_LOG"
rg -q '^drivers: [0-9]+/[0-9]+ ready$' "$BOOT_LOG"
rg -q '^manifest: maataa-os [0-9]' "$BOOT_LOG"
rg -q '^capsules loaded: [0-9]+$' "$BOOT_LOG"
rg -q '^capsule memory: [0-9]+/[0-9]+ bytes$' "$BOOT_LOG"
rg -q '^telemetry capsule id: ' "$BOOT_LOG"
rg -q '^control capsule id: ' "$BOOT_LOG"
rg -q '^clock: systick 1000 Hz, core ' "$BOOT_LOG"
rg -q '^board: qemu-netduinoplus2-stm32f405$' "$BOOT_LOG"
rg -q '^time: kernel-monotonic-since-boot$' "$BOOT_LOG"
rg -q '^sched: strict priority, round-robin within a level, tasks=8 quantum_ms=5$' "$BOOT_LOG"
[ "$(rg -c '^sched:' "$BOOT_LOG")" -eq 1 ]
rg -q '^uptime ns: [0-9]+$' "$BOOT_LOG"
rg -q '^hemant anchor: host-unix-clock-unverified$' "$BOOT_LOG"
rg -q '^hemant ns since epoch: [0-9]+$' "$BOOT_LOG"
rg -q '^hemant position: ahoratra [0-9]+ muhurta [0-9]+ kala [0-9]+ kastha [0-9]+ nimesha [0-9]+$' "$BOOT_LOG"
rg -q '^capsule verified: telemetry caps=write,sleep,store_get,store_put$' "$BOOT_LOG"
rg -q '^capsule verified: hostlink caps=write,sleep,uart_write,uart_read,host_status,store_get,store_put,capsule_install$' "$BOOT_LOG"
rg -q '^flash store: bank [01] generation [0-9]+ ' "$BOOT_LOG"
rg -q '^boot count: [0-9]+$' "$BOOT_LOG"
rg -q '^reset cause: unknown$' "$BOOT_LOG"
rg -q '^last crash: none$' "$BOOT_LOG"
rg -q '^watchdog: not available on this board$' "$BOOT_LOG"
rg -q '^flash store: sealed with ChaCha20-Poly1305, development \(public; integrity only\) key bound to this chip, id [0-9a-f]{8}$' "$BOOT_LOG"
if rg -q '^capsule rejected' "$BOOT_LOG"; then
    echo "FAIL: a built-in capsule was rejected" >&2
    exit 1
fi
rg -q '^capsule tamper check: rejected \(bad signature\)$' "$BOOT_LOG"
rg -q '^task 3: led without capability -> ENOCAP$' "$BOOT_LOG"
# MPU (docs/kernel-mpu.md): task 4 writes kernel RAM and task 5 overflows
# its stack; the kernel kills both, and the kernel word stays untouched.
rg -q '^task 4 violated memory: data access at 0x[0-9a-f]{8} \(pc 0x[0-9a-f]{8}\); task killed, kernel word still 0x00000000$' "$BOOT_LOG"
rg -q '^task 5 overflowed its stack \(stacking, mmfsr=0x[0-9a-f]{2}\); task killed$' "$BOOT_LOG"
# Task 7 runs the signed telemetry capsule's WebAssembly; its manifest has no
# LED capability, so its LED import must be refused.
rg -q '^capsule telemetry: wasm loaded .* 4096 bytes of memory\)$' "$BOOT_LOG"
rg -q '^capsule telemetry: telemetry capsule up$' "$BOOT_LOG"
rg -q '^capsule telemetry: init -> -16 \(ENOCAP\)$' "$BOOT_LOG"
rg -q '^capsule telemetry: tick 3 -> 233 ' "$BOOT_LOG"
# Two capsule tasks, each on the schedule and with the capabilities its own
# signed manifest gives (docs/wasm-capsules.md).
rg -q '^capsule verified: heartbeat caps=write,sleep$' "$BOOT_LOG"
rg -q '^capsule task 7: telemetry \(priority 1\)$' "$BOOT_LOG"
rg -q '^capsule task 8: heartbeat \(priority 1\)$' "$BOOT_LOG"
rg -q '^capsule telemetry: schedule: 3 ticks every 200 ms \(signed manifest\)$' "$BOOT_LOG"
rg -q '^capsule heartbeat: schedule: 4 ticks every 300 ms \(signed manifest\)$' "$BOOT_LOG"
rg -q '^kernel: task 8 has no capability for syscall 16$' "$BOOT_LOG"
rg -q '^capsule heartbeat: init -> -16 \(ENOCAP\)$' "$BOOT_LOG"
rg -q '^capsule heartbeat: tick 4 -> 4 ' "$BOOT_LOG"
rg -q '^capsule heartbeat: done$' "$BOOT_LOG"

# Strict priority (src/main.rs): task 2 (level 3) starts first, then task 3
# (level 2), and task 1 (level 1) only once both have blocked.
TASK_ORDER="$(rg '^task [123]$' "$BOOT_LOG" | head -n 3 | tr '\n' ' ')"
[ "$TASK_ORDER" = "task 2 task 3 task 1 " ]
# The demo's blocking paths still hand off under priorities: the mutex task 1
# held through its sleep reaches task 2, and task 3's post wakes task 2.
rg -q '^task 2: mutex 0 handed off; protected output is serialized$' "$BOOT_LOG"
# RECV through the SVC: the first wait times out (E_TIMEOUT), the second
# gets task 3's message with the sender in r1 (docs/SVC_TEST_COVERAGE.md).
rg -q '^task 2: recv timed out after 1000 ms$' "$BOOT_LOG"
rg -q '^task 2: received from task 3: Hello from Task 3 after 1500 ms; waiting on mutex 0$' "$BOOT_LOG"
rg -q '^task 2: semaphore 0 permit received; producer wake verified$' "$BOOT_LOG"
# Error codes back through the svc instruction (src/main.rs svc_error_paths).
for line in \
    'mutex_lock(4) -> EBADMUTEX' \
    'mutex_unlock(3) unowned -> ENOTOWNER' \
    'mutex_lock(3) twice -> EDEADLK' \
    'park holding mutex 3 -> EBUSY' \
    'semaphore_wait(4) -> EBADSEMAPHORE' \
    'semaphore_post(4) -> EBADSEMAPHORE' \
    'svc #20 -> ENOCAP'; do
    rg -qF "task 2: svc error $line" "$BOOT_LOG"
done
# Task 4 dies (MPU test) holding mutex 2; its next owner is told.
rg -q '^task 2: mutex 2: its owner died holding it \(EOWNERDEAD\); recovered$' "$BOOT_LOG"
if rg -q '^sched: task [0-9]+ \(priority [0-9]+\) ready for' "$BOOT_LOG"; then
    echo "FAIL: a task starved in the demo" >&2
    exit 1
fi
if rg -q '^park refused' "$BOOT_LOG"; then
    echo "FAIL: a task could not park" >&2
    exit 1
fi
pass

STEP="QEMU clock self-test"
./scripts/qemu-clock-test.sh
pass

STEP="QEMU host channel"
./scripts/qemu-host-channel-test.sh
pass

STEP="QEMU persistent store"
./scripts/qemu-persistence-test.sh
pass

STEP="QEMU run-time capsule install"
./scripts/qemu-capsule-install-test.sh
pass

STEP="QEMU store rollback counter (otp-rollback)"
./scripts/qemu-rollback-test.sh
pass

STEP="QEMU priority inheritance (inversion-test, pi-off)"
./scripts/qemu-inversion-test.sh
pass

STEP="QEMU panini capsule (sandhi through the store)"
./scripts/qemu-panini-test.sh
pass
