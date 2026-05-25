#!/bin/bash
set -e

echo "⚡ Flashing Maataa OS..."

# Flash using probe-rs
probe-rs run --chip STM32F411CEUx target/thumbv7em-none-eabihf/release/maataa-os

echo "✅ Flash complete!"
