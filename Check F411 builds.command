#!/bin/bash
# Double-click: build the F411 kernel twice (default = RTT-friendly NOP idle; low-power = WFI idle)
# and the QEMU kernel. Builds only; nothing is flashed. Output: target/f411-builds.log
cd "$(dirname "$0")" || exit 1
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
RUSTC="$(rustup which rustc 2>/dev/null || command -v rustc)"; export RUSTC
T=thumbv7em-none-eabihf
ok=0
{
  echo "== board-f411"; cargo build --release --target $T --no-default-features --features board-f411 --bin maataa-os 2>&1 | tail -3; ok=$((ok+${PIPESTATUS[0]}))
  echo "== board-f411,low-power"; cargo build --release --target $T --no-default-features --features board-f411,low-power --bin maataa-os --target-dir target/low-power 2>&1 | tail -3; ok=$((ok+${PIPESTATUS[0]}))
  echo "== board-qemu-f405 (default)"; cargo build --release --target $T --bin maataa-os --target-dir target/qemu 2>&1 | tail -3; ok=$((ok+${PIPESTATUS[0]}))
  [ $ok -eq 0 ] && echo "✓ all three builds passed" || echo "✗ a build failed"
} 2>&1 | tee target/f411-builds.log
read -r -t 900 -p "Press Return to close." _
