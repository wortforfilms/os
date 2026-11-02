#!/bin/bash
# Double-click: QEMU TEST build (kernel-stack-test): the kernel must catch its own stack overflow and stop.
# The demo ends itself through semihosting (task 3 calls svc #3). Output: target/qemu-run.log
cd "$(dirname "$0")" || exit 1
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
LOG=target/qemu-kstack.log
mkdir -p target
pause(){ read -r -t 900 -p "Press Return to close." _; }
command -v qemu-system-arm >/dev/null || { echo "qemu-system-arm not found (brew install qemu)."; pause; exit 1; }
ELF=target/qemu-kstack/thumbv7em-none-eabihf/release/maataa-os
RUSTC="$(rustup which rustc 2>/dev/null || command -v rustc)" cargo build --release \
  --target thumbv7em-none-eabihf --features kernel-stack-test --bin maataa-os --target-dir target/qemu-kstack 2>&1 | tail -2
[ "${PIPESTATUS[0]}" -eq 0 ] || { echo "✗ Build failed."; pause; exit 1; }
qemu-system-arm -machine netduinoplus2 -cpu cortex-m4 -kernel "$ELF" -nographic \
  -semihosting -semihosting-config enable=on,target=native -monitor none -serial null > "$LOG" 2>&1 &
QP=$!
for i in $(seq 1 30); do kill -0 "$QP" 2>/dev/null || break; sleep 1; done
if kill -0 "$QP" 2>/dev/null; then kill "$QP"; echo "(stopped after 30 s)" >> "$LOG"; fi
wait "$QP" 2>/dev/null; echo "exit status: $?" >> "$LOG"
cat "$LOG"
echo
if grep -q "KERNEL STACK OVERFLOW" "$LOG"; then echo "✓ QEMU: the kernel stack guard caught the overflow."; else echo "? No guard report in $LOG"; fi
pause
