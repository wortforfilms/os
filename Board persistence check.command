#!/bin/bash
# Double-click: check that the persistent store survives a reset on a
# Nucleo-F411RE that is already flashed (Flash Nucleo F411.command).
# Writes key 40, resets the board with the debug probe, reads key 40 back.
# Close any serial terminal on the port first. Output: target/board-persistence.txt
cd "$(dirname "$0")" || exit 1
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
CHIP=STM32F411RETx
OUT=target/board-persistence.txt
mkdir -p target
pause(){ read -r -t 900 -p "Press Return to close." _; }

PORT="${MAATAA_SERIAL:-$(ls /dev/cu.usbmodem* 2>/dev/null | head -n 1)}"
if [ -z "$PORT" ]; then
  echo "No /dev/cu.usbmodem* port found. Is the Nucleo connected?" | tee "$OUT"
  pause; exit 1
fi
VALUE="reset-check-$(date +%H%M%S)"
{
  echo "port: $PORT"
  cargo build --release -p maataa-link --features cli || exit 1
  L="target/release/maataa-link --serial $PORT --timeout-ms 3000"
  $L put 40 "$VALUE" || { echo "FAIL: put"; exit 1; }
  echo "resetting the board..."
  probe-rs reset --chip "$CHIP"
  sleep 4
  OUTPUT="$($L get 40)"
  echo "$OUTPUT"
  if echo "$OUTPUT" | grep -q "\"$VALUE\""; then
    echo "PASS: key 40 survived the reset"
  else
    echo "FAIL: key 40 did not survive the reset"
  fi
} 2>&1 | tee "$OUT"
pause
