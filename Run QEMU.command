#!/bin/bash
# Double-click: build the QEMU kernel (STM32F405, netduinoplus2) and run it for up to 30 seconds.
# The demo ends itself through semihosting (task 3 calls svc #3). Output: target/qemu-run.log
cd "$(dirname "$0")" || exit 1
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
LOG=target/qemu-run.log
mkdir -p target
pause(){ read -r -t 900 -p "Press Return to close." _; }
command -v qemu-system-arm >/dev/null || { echo "qemu-system-arm not found (brew install qemu)."; pause; exit 1; }
ELF=target/qemu/thumbv7em-none-eabihf/release/maataa-os
RUSTC="$(rustup which rustc 2>/dev/null || command -v rustc)" cargo build --release \
  --target thumbv7em-none-eabihf --bin maataa-os --target-dir target/qemu 2>&1 | tail -2
[ "${PIPESTATUS[0]}" -eq 0 ] || { echo "✗ Build failed."; pause; exit 1; }
qemu-system-arm -machine netduinoplus2 -cpu cortex-m4 -kernel "$ELF" -nographic \
  -semihosting -semihosting-config enable=on,target=native -monitor none -serial null > "$LOG" 2>&1 &
QP=$!
for i in $(seq 1 30); do kill -0 "$QP" 2>/dev/null || break; sleep 1; done
if kill -0 "$QP" 2>/dev/null; then kill "$QP"; echo "(stopped after 30 s)" >> "$LOG"; fi
wait "$QP" 2>/dev/null; echo "exit status: $?" >> "$LOG"
cat "$LOG"
echo
if grep -q "violated memory" "$LOG" && grep -q "task 3" "$LOG"; then echo "✓ QEMU: tasks ran unprivileged and task 4 was killed by the MPU."
else echo "? Check $LOG"; fi
pause
