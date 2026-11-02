#!/bin/bash
# Double-click: TEST build (kernel-stack-test): task 2 makes the kernel overflow its own stack; the kernel must report it and stop.
# The RTT output is shown here and saved to target/nucleo-run.log. Nothing is deleted.
# For a Black Pill, change CHIP to STM32F411CEUx.
cd "$(dirname "$0")" || exit 1
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
# Keep the Mac awake until this script exits: when the Mac sleeps, the
# ST-LINK resets the board (docs/EVIDENCE_MATRIX.md).
command -v caffeinate >/dev/null && caffeinate -dimsu -w $$ &
CHIP=STM32F411RETx
SECONDS_TO_RUN=30
LOG=target/nucleo-kstack.log
pause(){ read -r -t 900 -p "Press Return to close." _; }
mkdir -p target
if pgrep -x probe-rs >/dev/null; then
  echo "Another probe-rs is running (for example a 'probe-rs debug' window) and holds the ST-LINK."
  echo "Close that window first, then double-click this file again."
  pause; exit 1
fi
echo "Building Maataa OS for $CHIP…"
RUSTC="$(rustup which rustc 2>/dev/null || command -v rustc)" cargo build --release \
  --target thumbv7em-none-eabihf --no-default-features --features board-f411,kernel-stack-test --bin maataa-os --target-dir target/kstack 2>&1 | tee target/nucleo-build.log
[ "${PIPESTATUS[0]}" -eq 0 ] || { echo "✗ Build failed (target/nucleo-build.log)."; pause; exit 1; }
echo "Flashing and running for $SECONDS_TO_RUN seconds…"
# probe-rs prints RTT only to a terminal, so run it under `script`, which gives it one
# and copies everything to the log as well.
( sleep "$SECONDS_TO_RUN"; PR=$(pgrep -n -x probe-rs); [ -n "$PR" ] && kill -INT "$PR" ) &
script -q "$LOG" probe-rs run --chip "$CHIP" target/kstack/thumbv7em-none-eabihf/release/maataa-os
echo
# Diagnostics: read the RTT control block and the first bytes the firmware wrote.
ELF=target/kstack/thumbv7em-none-eabihf/release/maataa-os
NM=$(command -v arm-none-eabi-nm || command -v llvm-nm || echo nm)
ADDR=$("$NM" "$ELF" 2>/dev/null | awk '/ _SEGGER_RTT$/{print $1}')
[ -n "$ADDR" ] || ADDR=$(python3 - "$ELF" <<'PY'
import struct,sys
d=open(sys.argv[1],'rb').read()
shoff,=struct.unpack_from('<I',d,0x20); shentsize,shnum,shstrndx=struct.unpack_from('<HHH',d,0x2e)
secs=[struct.unpack_from('<IIIIIIIIII',d,shoff+i*shentsize) for i in range(shnum)]
for s in secs:
    if s[1]==2:  # SHT_SYMTAB
        strtab=secs[s[6]]
        for o in range(s[4],s[4]+s[5],16):
            name,value=struct.unpack_from('<II',d,o)
            n=d[strtab[4]+name:d.index(b'\0',strtab[4]+name)]
            if n==b'_SEGGER_RTT': print('%08x'%value)
PY
)
if [ -n "$ADDR" ]; then
  echo "RTT control block at 0x$ADDR" | tee target/nucleo-rtt.txt
  probe-rs read --chip "$CHIP" b32 "0x$ADDR" 12 2>&1 | tee -a target/nucleo-rtt.txt
  BUF=$(probe-rs read --chip "$CHIP" b32 "0x$ADDR" 12 2>/dev/null | tr -s ' ' '\n' | grep -E '^[0-9a-fA-F]{8}$' | sed -n '8p')
  [ -n "$BUF" ] && { echo "up buffer 0x$BUF:"; probe-rs read --chip "$CHIP" b8 "0x$BUF" 256 2>&1; } | tee -a target/nucleo-rtt.txt
fi
if grep -aq "KERNEL STACK OVERFLOW" "$LOG"; then echo "✓ The kernel stack guard caught the overflow:"; grep -a "KERNEL STACK OVERFLOW" "$LOG" | tr -d "\000\r"
else echo "? No guard report. Full output: $LOG"; grep -a "HARD FAULT\|KERNEL\|Exception" "$LOG" | tr -d "\000\r"; fi
pause
