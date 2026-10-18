#!/bin/bash
# Build for a real STM32F411 board and flash + run it with probe-rs.
#
#   ./scripts/run-hw.sh [binary]          binary: maataa-os (default) or clock_selftest
#   PROBE_RS_CHIP=STM32F411RETx ./scripts/run-hw.sh    # Nucleo-F411RE
#
# Needs: a debug probe (ST-LINK on the Nucleo, or an external ST-LINK /
# CMSIS-DAP for the Black Pill) and probe-rs (https://probe.rs, e.g.
# `cargo install probe-rs-tools --locked`).
#
# The kernel prints over semihosting. Without a debugger attached, a
# semihosting call stops the CPU, so only run these binaries through probe-rs.
# Hardware builds do not ask the host for the time (no Hemant anchor), and
# the clock self-test skips its host-time checks.
set -euo pipefail

BIN=${1:-maataa-os}
CHIP=${PROBE_RS_CHIP:-STM32F411CEUx}
TARGET=thumbv7em-none-eabihf

if ! command -v probe-rs >/dev/null 2>&1; then
    echo "probe-rs not found. Install it: https://probe.rs/docs/getting-started/installation/" >&2
    exit 1
fi

cargo build --release --target "$TARGET" --no-default-features --features board-f411 --bin "$BIN"
probe-rs run --chip "$CHIP" "target/$TARGET/release/$BIN"
