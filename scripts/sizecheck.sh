#!/bin/bash
# Kernel flash size for every build that runs: both boards, release and
# debug. The kernel owns flash sectors 0-4 (128 KiB); sector 5 is the
# run-time capsule area and sectors 6-7 the persistent store (memory.x), so
# an image over 128 KiB fails. Above 90% it warns: debug builds are the
# tightest (docs/size.md).
set -euo pipefail

TARGET=thumbv7em-none-eabihf
ELF=target/$TARGET
MAX_SIZE=131072
WARN_SIZE=$((MAX_SIZE * 90 / 100))
RUSTC="${RUSTC:-$(rustup which rustc)}"
export RUSTC

SIZE_TOOL=""
for tool in arm-none-eabi-size llvm-size rust-size; do
    if command -v "$tool" >/dev/null 2>&1; then SIZE_TOOL=$tool; break; fi
done
[ -n "$SIZE_TOOL" ] || { echo "no size tool (arm-none-eabi-size, llvm-size or rust-size)" >&2; exit 1; }

echo "Kernel flash use (text + data) against $MAX_SIZE bytes, warning above $WARN_SIZE"
failed=0
# QEMU release last, so target/$TARGET/release is the default build again.
for build in "F411 release|release|--release --no-default-features --features board-f411" \
             "F411 debug|debug|--no-default-features --features board-f411" \
             "QEMU debug|debug|" \
             "QEMU release|release|--release"; do
    IFS='|' read -r name profile args <<<"$build"
    # shellcheck disable=SC2086
    cargo build -q --target "$TARGET" $args --bin maataa-os
    used=$("$SIZE_TOOL" -B "$ELF/$profile/maataa-os" | tail -1 | awk '{print $1 + $2}')
    pct=$((used * 1000 / MAX_SIZE))
    line=$(printf '%-13s %6d bytes  %3d.%d%%  %6d free' "$name" "$used" $((pct / 10)) $((pct % 10)) $((MAX_SIZE - used)))
    if [ "$used" -gt "$MAX_SIZE" ]; then
        echo "FAIL $line"
        failed=1
    elif [ "$used" -gt "$WARN_SIZE" ]; then
        echo "WARN $line"
    else
        echo "ok   $line"
    fi
done
if [ "$failed" -ne 0 ]; then
    echo "a kernel image exceeds $MAX_SIZE bytes" >&2
    exit 1
fi
echo "all kernel builds fit"
