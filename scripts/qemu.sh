#!/bin/bash
set -e

echo "🎮 Starting Maataa OS in QEMU..."

# Build the OS first
echo "🔨 Building Maataa OS..."
cargo build --release --target thumbv7em-none-eabihf

# Run in QEMU
echo "🚀 Launching QEMU..."
qemu-system-arm \
    -machine netduinoplus2 \
    -cpu cortex-m4 \
    -kernel target/thumbv7em-none-eabihf/release/maataa-os \
    -nographic \
    -semihosting \
    -semihosting-config enable=on,target=native \
    -serial mon:stdio \
    -s \
    -S

echo "✅ QEMU session ended"
