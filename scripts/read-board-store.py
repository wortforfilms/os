#!/usr/bin/env python3
"""Reads the persistent store straight from the Nucleo's flash with probe-rs
(no serial port needed) and prints the boot count (key 0), the last reset
record (key 1) and the telemetry capsule's lifetime tick count (key 32).
Format: crates/maataa-store and maataa_link::BootRecord.

    python3 scripts/read-board-store.py [CHIP]
"""
import re
import subprocess
import sys
import zlib

CHIP = sys.argv[1] if len(sys.argv) > 1 else "STM32F411RETx"
BANKS = [0x0804_0000, 0x0806_0000]
READ = 8192  # bytes per bank to read; the live records sit at the start
CAUSES = ["unknown", "power-on", "reset pin or debugger", "software reset", "watchdog",
          "window watchdog", "low-power reset", "brown-out"]
CRASHES = ["none", "kernel panic", "kernel stack overflow", "kernel memory fault", "hard fault"]


def read_bank(base):
    out = subprocess.run(["probe-rs", "read", "--chip", CHIP, "b32", hex(base), str(READ // 4)],
                         capture_output=True, text=True, check=True).stdout
    words = re.findall(r"\b[0-9a-fA-F]{8}\b", " ".join(l.split(":", 1)[-1] for l in out.splitlines()))
    return b"".join(int(w, 16).to_bytes(4, "little") for w in words)


def header(bank):
    if bank[:4] != b"MKV1" or zlib.crc32(bank[:12]) != int.from_bytes(bank[12:16], "little"):
        return None
    return int.from_bytes(bank[4:8], "little")


def records(bank):
    at, latest = 16, {}
    while at + 4 <= len(bank):
        head = bank[at:at + 4]
        if head == b"\xff" * 4:
            break
        key, length = head[0], head[1]
        padded = (length + 3) & ~3
        value = bank[at + 4:at + 4 + length]
        crc = int.from_bytes(bank[at + 4 + padded:at + 8 + padded], "little")
        if zlib.crc32(head + value) != crc:
            break
        latest[key] = value
        at += 8 + padded
    return latest


banks = [read_bank(b) for b in BANKS]
gens = [header(b) for b in banks]
valid = [(g, i) for i, g in enumerate(gens) if g is not None]
if not valid:
    sys.exit("no valid store bank found")
gen, active = max(valid)
latest = records(banks[active])
print(f"store: bank {active}, generation {gen}, keys {sorted(latest)}")
if 0 in latest:
    print(f"boot count: {int.from_bytes(latest[0], 'little')}")
if 1 in latest and len(latest[1]) == 16:
    r = latest[1]
    cause = CAUSES[r[0]] if r[0] < len(CAUSES) else "unknown"
    crash = CRASHES[r[1]] if r[1] < len(CRASHES) else "none"
    print(f"reset cause: {cause}")
    print(f"last crash: {crash}" + ("" if r[1] == 0 else
          f" (address {int.from_bytes(r[4:8], 'little'):#010x}, detail {int.from_bytes(r[8:12], 'little'):#010x}, at {int.from_bytes(r[12:16], 'little')} ms)"))
if 32 in latest and len(latest[32]) == 4:
    print(f"telemetry capsule lifetime ticks (key 32): {int.from_bytes(latest[32], 'little')}")
