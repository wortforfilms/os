"""Local script logic matrices for Maataa OS.

The module keeps ancient-script parsing deterministic and offline. It uses only
standard-library data structures and a local thread pool, so callers can batch
work without introducing external service dependencies.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Iterable, Mapping


@dataclass(frozen=True)
class ScriptGlyph:
    codepoint: str
    transliteration: str
    phoneme: str
    class_name: str
    weight: int


@dataclass(frozen=True)
class ParseToken:
    script: str
    glyph: str
    codepoint: str
    transliteration: str
    phoneme: str
    class_name: str
    weight: int


SCRIPT_MATRICES: Mapping[str, Mapping[str, ScriptGlyph]] = {
    "brahmi": {
        "𑀅": ScriptGlyph("U+11005", "a", "vowel-open", "vowel", 1),
        "𑀆": ScriptGlyph("U+11006", "aa", "vowel-long", "vowel", 2),
        "𑀓": ScriptGlyph("U+11013", "ka", "velar-stop", "consonant", 3),
        "𑀫": ScriptGlyph("U+1102B", "ma", "bilabial-nasal", "consonant", 3),
        "𑀢": ScriptGlyph("U+11022", "ta", "dental-stop", "consonant", 3),
    },
    "kharosthi": {
        "𐨀": ScriptGlyph("U+10A00", "a", "vowel-open", "vowel", 1),
        "𐨐": ScriptGlyph("U+10A10", "ka", "velar-stop", "consonant", 3),
        "𐨨": ScriptGlyph("U+10A28", "ma", "bilabial-nasal", "consonant", 3),
        "𐨟": ScriptGlyph("U+10A1F", "ta", "dental-stop", "consonant", 3),
        "𐨯": ScriptGlyph("U+10A2F", "sa", "sibilant", "consonant", 3),
    },
    "siddham": {
        "𑖀": ScriptGlyph("U+11580", "a", "vowel-open", "vowel", 1),
        "𑖁": ScriptGlyph("U+11581", "aa", "vowel-long", "vowel", 2),
        "𑖎": ScriptGlyph("U+1158E", "ka", "velar-stop", "consonant", 3),
        "𑖦": ScriptGlyph("U+115A6", "ma", "bilabial-nasal", "consonant", 3),
        "𑖝": ScriptGlyph("U+1159D", "ta", "dental-stop", "consonant", 3),
    },
}


def parse_script_text(script: str, text: str) -> list[ParseToken]:
    matrix = SCRIPT_MATRICES.get(script)
    if matrix is None:
        raise ValueError(f"unsupported script matrix: {script}")

    tokens: list[ParseToken] = []
    for glyph in text:
        if glyph.isspace():
            continue

        entry = matrix.get(glyph)
        if entry is None:
            tokens.append(
                ParseToken(
                    script=script,
                    glyph=glyph,
                    codepoint=f"U+{ord(glyph):04X}",
                    transliteration="?",
                    phoneme="unknown",
                    class_name="unknown",
                    weight=0,
                )
            )
            continue

        tokens.append(
            ParseToken(
                script=script,
                glyph=glyph,
                codepoint=entry.codepoint,
                transliteration=entry.transliteration,
                phoneme=entry.phoneme,
                class_name=entry.class_name,
                weight=entry.weight,
            )
        )

    return tokens


def parse_script_batches(jobs: Iterable[tuple[str, str]], workers: int = 3) -> list[list[ParseToken]]:
    safe_workers = max(1, min(workers, 8))
    with ThreadPoolExecutor(max_workers=safe_workers, thread_name_prefix="maataa-script") as pool:
        return list(pool.map(lambda job: parse_script_text(job[0], job[1]), jobs))


def summarize_tokens(tokens: Iterable[ParseToken]) -> dict[str, int]:
    summary = {"known": 0, "unknown": 0, "weight": 0}
    for token in tokens:
        if token.class_name == "unknown":
            summary["unknown"] += 1
        else:
            summary["known"] += 1
            summary["weight"] += token.weight
    return summary
