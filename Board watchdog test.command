#!/bin/bash
# Double-click: watchdog test on a Nucleo-F411RE.
#   1. builds the watchdog-test kernel and flashes it;
#   2. records the serial port for 30 s: task 2 asks the kernel to hang with
#      interrupts off, the watchdog must reset the board after about 8 s, and
#      the next boot must report "reset cause: watchdog";
#   3. reads the saved reset record over the host channel.
# Afterwards flash the normal kernel again (Flash Nucleo F411.command).
# Close any serial terminal on the port first. Output: target/board-watchdog.txt
cd "$(dirname "$0")" || exit 1
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
CHIP=STM32F411RETx
OUT=target/board-watchdog.txt
ELF=target/wdtest/thumbv7em-none-eabihf/release/maataa-os
mkdir -p target
pause(){ read -r -t 900 -p "Press Return to close." _; }
{
  echo "Building the watchdog-test kernel…"
  RUSTC="$(rustup which rustc 2>/dev/null || command -v rustc)" cargo build --release \
    --target thumbv7em-none-eabihf --no-default-features --features board-f411,watchdog-test \
    --bin maataa-os --target-dir target/wdtest 2>&1 | tail -1
  cargo build --release -p maataa-link --features cli 2>&1 | tail -1
  PORT="${MAATAA_SERIAL:-$(ls /dev/cu.usbmodem* 2>/dev/null | head -n 1)}"
  [ -n "$PORT" ] || { echo "No /dev/cu.usbmodem* port found."; exit 1; }
  echo "port: $PORT"
  exec 3<>"$PORT"
  stty 115200 raw -echo cs8 -cstopb -parenb clocal <&3
  ( cat <&3 > target/board-watchdog.raw ) &
  CAT=$!
  echo "Flashing…"
  probe-rs download --chip "$CHIP" "$ELF" 2>&1 | tail -1
  probe-rs reset --chip "$CHIP" 2>&1
  echo "Waiting 30 s for the hang and the watchdog reset…"
  sleep 30
  kill $CAT 2>/dev/null
  exec 3<&-
  echo "--- serial (selected lines) ---"
  tr -d '\000' < target/board-watchdog.raw | tr '\r' '\n' \
    | grep -a -E 'reset cause|last crash|watchdog|boot count' | head -20
  echo "--- reset record over the host channel ---"
  target/release/maataa-link --serial "$PORT" --timeout-ms 3000 boot-info
  if tr -d '\000' < target/board-watchdog.raw | grep -aq 'watchdog test: PASS'; then
    echo "PASS: the watchdog reset the hung kernel"
  else
    echo "FAIL: no 'watchdog test: PASS' line on the serial port"
  fi
} 2>&1 | tee "$OUT"
pause
