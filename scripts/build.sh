#!/bin/bash
set -e

echo "🔨 Building Maataa OS..."

# Check if target is installed
rustup target add thumbv7em-none-eabihf

# Build the embedded kernel image
cargo build --release --target thumbv7em-none-eabihf

echo "✅ Build complete!"
echo "📦 Binary size:"
arm-none-eabi-size target/thumbv7em-none-eabihf/release/maataa-os
