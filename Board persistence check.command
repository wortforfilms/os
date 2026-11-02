#!/bin/bash
# Double-click twice to check that the persistent store survives a power cycle
# on a Nucleo-F411RE that is already flashed (Flash Nucleo F411.command):
#   1st run: writes a fresh value to key 40, then asks you to unplug and
#            replug the board's USB cable;
#   2nd run: reads key 40 and compares.
# Close any serial terminal on the port first. Output: target/board-persistence.txt
cd "$(dirname "$0")" || exit 1
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
# Keep the Mac awake until this script exits: when the Mac sleeps, the
# ST-LINK resets the board (docs/EVIDENCE_MATRIX.md).
command -v caffeinate >/dev/null && caffeinate -dimsu -w $$ &
OUT=target/board-persistence.txt
PENDING=target/board-persistence.pending
mkdir -p target
pause(){ read -r -t 900 -p "Press Return to close." _; }

PORT="${MAATAA_SERIAL:-$(ls /dev/cu.usbmodem* 2>/dev/null | head -n 1)}"
if [ -z "$PORT" ]; then
  echo "No /dev/cu.usbmodem* port found. Is the Nucleo connected?" | tee "$OUT"
  pause; exit 1
fi
{
  echo "port: $PORT"
  cargo build --release -p maataa-link --features cli || exit 1
  L="target/release/maataa-link --serial $PORT --timeout-ms 3000"
  if [ -f "$PENDING" ]; then
    VALUE="$(cat "$PENDING")"
    OUTPUT="$($L get 40)"
    echo "$OUTPUT"
    if echo "$OUTPUT" | grep -q "\"$VALUE\""; then
      echo "PASS: key 40 still holds \"$VALUE\" after the power cycle"
      rm -f "$PENDING"
    else
      echo "FAIL: expected \"$VALUE\" in key 40"
    fi
  else
    VALUE="power-cycle-$(date +%H%M%S)"
    if $L put 40 "$VALUE"; then
      echo "$VALUE" > "$PENDING"
      echo "Step 1 done. Now unplug the board's USB cable, plug it back in,"
      echo "wait until LD1 is green, and double-click this file again."
    else
      echo "FAIL: could not write key 40"
    fi
  fi
} 2>&1 | tee "$OUT"
pause
