#!/usr/bin/env python3
"""Reads the persistent store straight from the Nucleo's flash with probe-rs
(no serial port needed) and prints the boot count (key 0), the last reset
record (key 1) and the telemetry capsule's lifetime tick count (key 32).
Format: crates/maataa-store and maataa_link::BootRecord.

The store is sealed with ChaCha20-Poly1305 under the build's master key bound
to the chip's unique id (src/storage/persist.rs). This script reads the id
with the probe and uses the development master key, or MAATAA_STORE_KEY
(64 hex characters) if it is set. A store in the earlier, unsealed format
(MKV1) is read too.

    python3 scripts/read-board-store.py [CHIP]
    python3 scripts/read-board-store.py --file target/qemu-flash.bin   # QEMU
"""
import os
import re
import struct
import subprocess
import sys
import zlib

DEV_KEY = b"maataa-os-dev-store-NOT-SECRET!!"
CAUSES = ["unknown", "power-on", "reset pin or debugger", "software reset", "watchdog",
          "window watchdog", "low-power reset", "brown-out"]
CRASHES = ["none", "kernel panic", "kernel stack overflow", "kernel memory fault", "hard fault"]


# --- ChaCha20-Poly1305 (RFC 8439), enough for short values -----------------

def _rotl(v, n):
    return ((v << n) & 0xFFFFFFFF) | (v >> (32 - n))


def _block(key, counter, nonce):
    c = [0x61707865, 0x3320646E, 0x79622D32, 0x6B206574]
    state = c + list(struct.unpack("<8I", key)) + [counter] + list(struct.unpack("<3I", nonce))
    w = state[:]

    def qr(a, b, c_, d):
        w[a] = (w[a] + w[b]) & 0xFFFFFFFF; w[d] = _rotl(w[d] ^ w[a], 16)
        w[c_] = (w[c_] + w[d]) & 0xFFFFFFFF; w[b] = _rotl(w[b] ^ w[c_], 12)
        w[a] = (w[a] + w[b]) & 0xFFFFFFFF; w[d] = _rotl(w[d] ^ w[a], 8)
        w[c_] = (w[c_] + w[d]) & 0xFFFFFFFF; w[b] = _rotl(w[b] ^ w[c_], 7)

    for _ in range(10):
        qr(0, 4, 8, 12); qr(1, 5, 9, 13); qr(2, 6, 10, 14); qr(3, 7, 11, 15)
        qr(0, 5, 10, 15); qr(1, 6, 11, 12); qr(2, 7, 8, 13); qr(3, 4, 9, 14)
    return struct.pack("<16I", *[(w[i] + state[i]) & 0xFFFFFFFF for i in range(16)])


def _chacha(key, counter, nonce, data):
    out = bytearray()
    for i in range(0, len(data), 64):
        ks = _block(key, counter + i // 64, nonce)
        out += bytes(a ^ b for a, b in zip(data[i:i + 64], ks))
    return bytes(out)


def _poly1305(key, msg):
    r = int.from_bytes(key[:16], "little") & 0x0FFFFFFC0FFFFFFC0FFFFFFC0FFFFFFF
    s = int.from_bytes(key[16:], "little")
    p, acc = (1 << 130) - 5, 0
    for i in range(0, len(msg), 16):
        n = int.from_bytes(msg[i:i + 16] + b"\x01", "little")
        acc = (acc + n) * r % p
    return ((acc + s) & ((1 << 128) - 1)).to_bytes(16, "little")


def _pad16(b):
    return b + b"\x00" * (-len(b) % 16)


def aead_tag(key, nonce, aad, ciphertext):
    otk = _block(key, 0, nonce)[:32]
    mac = _pad16(aad) + _pad16(ciphertext) + struct.pack("<QQ", len(aad), len(ciphertext))
    return _poly1305(otk, mac)


def aead_open(key, nonce, aad, ciphertext, tag):
    if aead_tag(key, nonce, aad, ciphertext) != tag:
        return None
    return _chacha(key, 1, nonce, ciphertext)


def device_key(master, device_id):
    return _chacha(master, 1, device_id, bytes(32))


def key_id(key):
    return int.from_bytes(aead_tag(key, b"\xff" * 12, b"maataa-store key id", b"")[:4], "little")


# --- store format ---------------------------------------------------------

def nonce(generation, offset):
    return struct.pack("<II", generation, offset) + b"MKV2"


def header(bank, key):
    """(format, generation) or None."""
    if bank[:4] == b"MKV1" and zlib.crc32(bank[:12]) == int.from_bytes(bank[12:16], "little"):
        return ("MKV1", int.from_bytes(bank[4:8], "little"))
    if bank[:4] != b"MKV2":
        return None
    generation = int.from_bytes(bank[4:8], "little")
    if int.from_bytes(bank[8:12], "little") != key_id(key):
        return ("foreign", generation)
    if aead_tag(key, nonce(generation, 0), bank[:16], b"") != bank[16:32]:
        return None
    return ("MKV2", generation)


def records(bank, fmt, generation, key):
    at = 32 if fmt == "MKV2" else 16
    tag_len = 16 if fmt == "MKV2" else 4
    latest = {}
    while at + 4 <= len(bank):
        head = bank[at:at + 4]
        if head == b"\xff" * 4:
            break
        k, length = head[0], head[1]
        padded = (length + 3) & ~3
        body = bank[at + 4:at + 4 + length]
        tag = bank[at + 4 + padded:at + 4 + padded + tag_len]
        if fmt == "MKV2":
            value = aead_open(key, nonce(generation, at), head, body, tag)
            if value is None:
                break
        else:
            if zlib.crc32(head + body) != int.from_bytes(tag, "little"):
                break
            value = body
        if length == 0:
            latest.pop(k, None)
        else:
            latest[k] = value
        at += 4 + padded + tag_len
    return latest


# --- reading the board ----------------------------------------------------

def probe_read(chip, address, nbytes):
    out = subprocess.run(["probe-rs", "read", "--chip", chip, "b32", hex(address), str(nbytes // 4)],
                         capture_output=True, text=True, check=True).stdout
    words = re.findall(r"\b[0-9a-fA-F]{8}\b", " ".join(l.split(":", 1)[-1] for l in out.splitlines()))
    return b"".join(int(w, 16).to_bytes(4, "little") for w in words)


def main():
    master = bytes.fromhex(os.environ["MAATAA_STORE_KEY"]) if os.environ.get("MAATAA_STORE_KEY") else DEV_KEY
    if len(sys.argv) > 2 and sys.argv[1] == "--file":
        data = open(sys.argv[2], "rb").read()
        half = len(data) // 2
        banks, device_id = [data[:half], data[half:]], b"qemu-netduin"
    else:
        chip = sys.argv[1] if len(sys.argv) > 1 else "STM32F411RETx"
        read = 8192  # bytes per bank; the live records sit at the start
        banks = [probe_read(chip, b, read) for b in (0x0804_0000, 0x0806_0000)]
        device_id = probe_read(chip, 0x1FFF_7A10, 12)
    key = device_key(master, device_id)
    found = [(header(b, key), i) for i, b in enumerate(banks)]
    if any(h and h[0] == "foreign" for h, _ in found) and not any(h and h[0] == "MKV2" for h, _ in found):
        sys.exit("store sealed with a different key (set MAATAA_STORE_KEY)")
    sealed = [(h[1], i) for h, i in found if h and h[0] == "MKV2"]
    unsealed = [(h[1], i) for h, i in found if h and h[0] == "MKV1"]
    if sealed:
        (gen, active), fmt = max(sealed), "MKV2"
    elif unsealed:
        (gen, active), fmt = max(unsealed), "MKV1"
    else:
        sys.exit("no valid store bank found")
    latest = records(banks[active], fmt, gen, key)
    sealing = f"sealed, key id {key_id(key):08x}" if fmt == "MKV2" else "unsealed (MKV1)"
    print(f"store: bank {active}, generation {gen}, {sealing}, keys {sorted(latest)}")
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


if __name__ == "__main__":
    main()
