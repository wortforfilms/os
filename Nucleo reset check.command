#!/bin/bash
# Double-click: read why the STM32F411 last reset (RCC_CSR) and the option bytes (FLASH_OPTCR).
# Read-only; the board keeps running. Output: target/nucleo-reset.txt
cd "$(dirname "$0")" || exit 1
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
CHIP=STM32F411RETx
OUT=target/nucleo-reset.txt
mkdir -p target
{
  echo "RCC_CSR (reset flags, 0x40023874):"; probe-rs read --chip "$CHIP" b32 0x40023874 1
  echo "FLASH_OPTCR (option bytes, 0x40023C14):"; probe-rs read --chip "$CHIP" b32 0x40023C14 1
  echo "IWDG_PR/RLR/SR (0x40003004):"; probe-rs read --chip "$CHIP" b32 0x40003004 3
  echo "DBGMCU_CR (0xE0042004):"; probe-rs read --chip "$CHIP" b32 0xE0042004 1
} 2>&1 | tee "$OUT"
read -r -t 900 -p "Press Return to close." _
