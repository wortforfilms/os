#!/bin/bash
# Double-click: TEST build (kernel-stack-test) on a Nucleo-F411RE. Task 2 makes
# the kernel overflow its own stack (svc #4); the kernel stack guard must
# report "KERNEL STACK OVERFLOW" and stop the system (docs/kernel-mpu.md).
# The kernel log comes over USART2 (the ST-LINK virtual COM port), recorded for
# 30 s while the board is flashed and reset. Close any serial terminal on the
# port first. Output: target/board-kstack.txt (raw serial: target/board-kstack.raw)
# The stopped kernel no longer feeds the watchdog, so the board resets and the
# test repeats until you flash the normal kernel again (Board test.command).
# For a Black Pill, change CHIP to STM32F411CEUx.
cd "$(dirname "$0")" || exit 1
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
# Keep the Mac awake until this script exits: when the Mac sleeps, the
# ST-LINK resets the board (docs/EVIDENCE_MATRIX.md).
command -v caffeinate >/dev/null && caffeinate -dimsu -w $$ &
CHIP=STM32F411RETx
OUT=target/board-kstack.txt
RAW=target/board-kstack.raw
ELF=target/kstack/thumbv7em-none-eabihf/release/maataa-os
mkdir -p target
pause(){ read -r -t 900 -p "Press Return to close." _; }
# The serial log holds COBS frames as well as text: read it as bytes, or
# macOS tr stops with "Illegal byte sequence" in a UTF-8 locale.
export LC_ALL=C
if pgrep -x probe-rs >/dev/null; then
  echo "Another probe-rs is running (for example a 'probe-rs debug' window) and holds the ST-LINK."
  echo "Close that window first, then double-click this file again."
  pause; exit 1
fi
{
  echo "Building the kernel-stack-test kernel…"
  RUSTC="$(rustup which rustc 2>/dev/null || command -v rustc)" cargo build --release \
    --target thumbv7em-none-eabihf --no-default-features --features board-f411,kernel-stack-test \
    --bin maataa-os --target-dir target/kstack 2>&1 | tail -1
  [ -f "$ELF" ] || { echo "FAIL: build failed"; exit 1; }
  PORT="${MAATAA_SERIAL:-$(ls /dev/cu.usbmodem* 2>/dev/null | head -n 1)}"
  [ -n "$PORT" ] || { echo "FAIL: no /dev/cu.usbmodem* port: is the Nucleo plugged in?"; exit 1; }
  echo "port: $PORT"
  exec 3<>"$PORT"
  stty 115200 raw -echo cs8 -cstopb -parenb clocal <&3
  ( cat <&3 > "$RAW" ) &
  CAT=$!
  echo "Flashing…"
  probe-rs download --chip "$CHIP" "$ELF" 2>&1 | tail -1
  probe-rs reset --chip "$CHIP" 2>&1
  echo "Recording the serial port for 30 s…"
  sleep 30
  kill $CAT 2>/dev/null
  wait $CAT 2>/dev/null
  exec 3<&-
  echo "--- serial (selected lines) ---"
  tr -d '\000' < "$RAW" | tr '\r' '\n' \
    | grep -a -E 'KERNEL STACK OVERFLOW|HARD FAULT|reset cause|last crash|^task 2' | head -20
  if tr -d '\000' < "$RAW" | grep -aq 'KERNEL STACK OVERFLOW'; then
    echo "PASS: the kernel stack guard caught the overflow"
  else
    echo "FAIL: no KERNEL STACK OVERFLOW report (full serial: $RAW)"
  fi
  echo "Next: flash the normal kernel again (Board test.command)."
} 2>&1 | tee "$OUT"
pause
