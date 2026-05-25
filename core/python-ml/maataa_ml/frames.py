"""Fixed-width binary frames for the local Maataa AI pipeline."""

from __future__ import annotations

import hashlib
import struct
from pathlib import Path

from .script_matrices import ParseToken

MAGV_BYTES = 32
MABS_BYTES = 24
MAGV_MAGIC = b"MAGV"
MABS_MAGIC = b"MABS"
SCRIPT_KEYS = {"brahmi": 0x01, "kharosthi": 0x02, "siddham": 0x03}


def _u32(value: int) -> int:
    if value < 0 or value > 0xFFFF_FFFF:
        raise ValueError(f"u32 out of range: {value}")
    return value


def _sha256_prefix(data: bytes, length: int) -> bytes:
    return hashlib.sha256(data).digest()[:length]


def encode_magv(token: ParseToken, index: int) -> bytes:
    script_key = SCRIPT_KEYS.get(token.script)
    if script_key is None:
        raise ValueError(f"unsupported script for MAGV: {token.script}")

    codepoint = ord(token.glyph) & 0xFFFF
    seed = (
        token.script.encode("utf-8")
        + token.glyph.encode("utf-8")
        + token.transliteration.encode("utf-8")
        + bytes([token.weight & 0xFF, index & 0xFF])
    )
    geometry = _sha256_prefix(seed, 20)
    prefix = MAGV_MAGIC + bytes([script_key]) + struct.pack("<H", codepoint) + geometry
    return prefix + _sha256_prefix(prefix + struct.pack("<I", index), 5)


def encode_mabs(total_glyphs: int, confidence_fixed: int, duration_ms: int, sha256sums_path: Path) -> bytes:
    manifest_digest = hashlib.sha256(sha256sums_path.read_bytes()).digest()[:8]
    return (
        MABS_MAGIC
        + struct.pack("<I", _u32(total_glyphs))
        + struct.pack("<I", _u32(confidence_fixed))
        + struct.pack("<I", _u32(duration_ms))
        + manifest_digest
    )


def fixed_confidence(known: int, total: int) -> int:
    if total <= 0:
        return 0
    return (known * 10_000) // total
