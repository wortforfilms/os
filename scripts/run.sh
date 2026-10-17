#!/bin/bash
set -e

echo "🎯 Maataa OS QEMU Launcher"
echo "=========================="

# Check if QEMU is installed
if ! command -v qemu-system-arm &> /dev/null; then
    echo "❌ QEMU not found. Please install QEMU first."
    echo "   macOS: brew install qemu"
    echo "   Ubuntu: sudo apt install qemu-system-arm"
    exit 1
fi

echo "✅ QEMU found: $(which qemu-system-arm)"

# Build the OS
echo ""
echo "🔨 Building Maataa OS..."
cargo build --release --target thumbv7em-none-eabihf

echo ""
echo "📊 Binary Info:"
arm-none-eabi-size target/thumbv7em-none-eabihf/release/maataa-os

echo ""
echo "🚀 Starting Maataa OS in QEMU..."
echo "   To exit: Press Ctrl+A then X"
echo "   The prototype exits automatically after its scheduler demo"
echo ""

# Run in QEMU. The kernel exits through semihosting after the demo.
qemu-system-arm \
    -machine netduinoplus2 \
    -cpu cortex-m4 \
    -kernel target/thumbv7em-none-eabihf/release/maataa-os \
    -nographic \
    -semihosting \
    -semihosting-config enable=on,target=native \
    -serial mon:stdio

echo ""
echo "✅ QEMU session ended"
