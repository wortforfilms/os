#!/bin/bash
set -e

echo "📏 Checking binary sizes..."

echo "=== Release Build ==="
arm-none-eabi-size target/thumbv7em-none-eabihf/release/maataa-os

echo -e "\n📊 Size analysis complete!"

# Check if binary exceeds limits
MAX_SIZE=524288  # 512KB
RELEASE_SIZE=$(arm-none-eabi-size -B target/thumbv7em-none-eabihf/release/maataa-os | tail -1 | awk '{print $1 + $2}')

if [ $RELEASE_SIZE -gt $MAX_SIZE ]; then
    echo "❌ WARNING: Binary size ($RELEASE_SIZE bytes) exceeds limit ($MAX_SIZE bytes)"
    exit 1
else
    echo "✅ Binary size within limits ($RELEASE_SIZE/$MAX_SIZE bytes)"
fi
