#!/bin/bash
set -e

echo "🐛 Starting QEMU with GDB debug server..."

# Build with debug info
echo "🔨 Building with debug symbols..."
cargo build --target thumbv7em-none-eabihf

echo "🎮 Starting QEMU (waiting for GDB connection on port 1234)..."
qemu-system-arm \
    -machine netduinoplus2 \
    -cpu cortex-m4 \
    -kernel target/thumbv7em-none-eabihf/debug/maataa-os \
    -nographic \
    -semihosting \
    -semihosting-config enable=on,target=native \
    -serial mon:stdio \
    -s \
    -S

echo "✅ QEMU debug session ended"
