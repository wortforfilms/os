#!/bin/bash
# Double-click: run the host channel selftest against a Nucleo-F411RE that is
# already flashed (Board test.command) and running.
# Uses the ST-LINK virtual COM port (/dev/cu.usbmodem*). Close any serial
# terminal (screen, minicom) on that port first. Output: target/board-hostlink.txt
cd "$(dirname "$0")" || exit 1
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
# Keep the Mac awake until this script exits: when the Mac sleeps, the
# ST-LINK resets the board (docs/EVIDENCE_MATRIX.md).
command -v caffeinate >/dev/null && caffeinate -dimsu -w $$ &
OUT=target/board-hostlink.txt
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
  # The kernel logs on the same UART; the tool skips that text.
  target/release/maataa-link --serial "$PORT" --timeout-ms 3000 selftest
  echo "exit status: $?"
} 2>&1 | tee "$OUT"
pause
