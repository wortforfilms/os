#!/bin/bash
# Double-click: install the greeter capsule at run time on a Nucleo-F411RE that
# runs this kernel (Flash Nucleo F411.command), reset the board with the probe,
# and check that greeter is installed. Uses the ST-LINK virtual COM port; close
# any serial terminal on it first. Output: target/board-capsule-install.txt
# Afterwards `maataa-link --serial PORT capsule-remove` removes it again.
cd "$(dirname "$0")" || exit 1
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
CHIP=STM32F411RETx
OUT=target/board-capsule-install.txt
mkdir -p target
pause(){ read -r -t 900 -p "Press Return to close." _; }

PORT="${MAATAA_SERIAL:-$(ls /dev/cu.usbmodem* 2>/dev/null | head -n 1)}"
if [ -z "$PORT" ]; then
  echo "No /dev/cu.usbmodem* port found. Is the Nucleo connected?" | tee "$OUT"
  pause; exit 1
fi
LINK="target/release/maataa-link --serial $PORT --timeout-ms 3000"
{
  echo "port: $PORT"
  cargo build --release -p maataa-link --features cli || exit 1
  echo "--- before ---"
  $LINK capsule-info
  echo "--- install ---"
  $LINK capsule-install assets/capsules/greeter.mcap
  echo "install exit status: $?"
  echo "--- reset ---"
  probe-rs reset --chip "$CHIP"
  sleep 4
  echo "--- after the reset ---"
  $LINK capsule-info
  $LINK status
  echo "done"
} 2>&1 | tee "$OUT"
pause
