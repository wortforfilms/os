#!/bin/bash
set -e

echo "🎮 Maataa OS - Interactive QEMU Session"
echo "======================================"

# Build first
echo "🔨 Building Maataa OS..."
cargo build --release --target thumbv7em-none-eabihf

echo ""
echo "🚀 Starting QEMU..."
echo ""
echo "CONTROLS:"
echo "  Ctrl+A then X  → Exit QEMU"
echo "  Ctrl+A then C  → Enter QEMU monitor"
echo "  Ctrl+A then H  → Show help"
echo ""
echo "The OS will run a short scheduler demo then exit automatically."
echo ""

# Run QEMU
qemu-system-arm \
    -machine netduinoplus2 \
    -cpu cortex-m4 \
    -kernel target/thumbv7em-none-eabihf/release/maataa-os \
    -nographic \
    -semihosting \
    -semihosting-config enable=on,target=native \
    -serial mon:stdio

echo ""
echo "🎉 QEMU session ended successfully!"
