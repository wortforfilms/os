# Lipi — Local Unicode Authority Dataset

**Status:** `CONTROLLED_NO_GO` · `governedProductionGo: false` · Lipi certification **not** claimed.

This document describes how MAATAA OS / Lipi absorbs the official Unicode Character
Database (`UnicodeData.txt`) as a **repo-local source of truth**. All numbers below
are generated from the file by `summarizeUnicodeData()` — none are hardcoded.

## Dataset

- Location: `data/unicode/UnicodeData.txt`
- Records parsed: **29,215**
- Source format: the canonical 15 semicolon-separated UCD fields.

## Parser

`packages/lipi-runtime/src/unicode-data.ts`. Only the fields **present** in the file
are read; no character meanings are invented. Each record carries: codepoint, hex,
name (verbatim), General_Category, combining class, bidi class, decomposition
(verbatim), the three numeric fields, bidi-mirrored, and the case mappings.

`block` is **DERIVED** from a table of **real Unicode block ranges** only. Any
codepoint outside those cited ranges is reported as `UNKNOWN` — never guessed.

### Functions

| Function | Behaviour |
|---|---|
| `parseUnicodeDataLine(line)` | one line → record, or `null` for blank/malformed (fail-closed) |
| `loadUnicodeData(path)` | reads + indexes the file; returns `{count, source}` |
| `getCharacterByCodepoint(cp)` | hex/`U+`/number → record, or `null` on a miss |
| `searchUnicodeByName(query)` | case-insensitive substring over the verbatim Name |
| `listByRange(start, end)` | inclusive codepoint range |
| `listDevanagari()` | `listByRange(0x0900, 0x097F)` |
| `listGurmukhi()` | `listByRange(0x0A00, 0x0A7F)` |
| `listIndicScripts()` | per-Indic-block counts (live) |
| `summarizeUnicodeData()` | totals by category + block (live, generated) |

All query functions fail closed if the dataset is not loaded.

## CLI

```
maataa lipi unicode lookup 0905      # U+0905 DEVANAGARI LETTER A
maataa lipi unicode search DEVANAGARI
maataa lipi unicode range 0900 097F
maataa lipi unicode summary
```

Unknown codepoints and unknown subcommands exit non-zero (fail-closed).

## Indic coverage (derived from real block ranges)

| Block | Range | Count |
|---|---|---:|
| Devanagari | 0900–097F | 128 |
| Bengali | 0980–09FF | 93 |
| Gurmukhi | 0A00–0A7F | 79 |
| Gujarati | 0A80–0AFF | 85 |
| Oriya | 0B00–0B7F | 90 |
| Tamil | 0B80–0BFF | 72 |
| Telugu | 0C00–0C7F | 96 |
| Kannada | 0C80–0CFF | 87 |
| Malayalam | 0D00–0D7F | 100 |
| Sinhala | 0D80–0DFF | 90 |
| Devanagari Extended | A8E0–A8FF | 30 |
| Vedic Extensions | 1CD0–1CFF | 41 |
| Kharoshthi | 10A00–10A5F | 65 |
| Brahmi | 11000–1107F | 109 |
| Sharada | 11180–111DF | 94 |
| Grantha | 11300–1137F | 85 |
| Siddham | 11580–115FF | 92 |
| Modi | 11600–1165F | 79 |
| Tirhuta | 11480–114DF | 82 |
| **Indic total (cited blocks)** | | **1,597** |

## Reconciliation with the prior Lipi glyph library

The earlier in-memory glyph library hardcoded Brahmi 115 / Kharoshthi 68 /
Devanagari 128 / Siddham 92 = 403. Against the authoritative block ranges:

| Script | Prior claim | UCD (block-derived) | Δ |
|---|---:|---:|---:|
| Devanagari | 128 | 128 | 0 |
| Siddham | 92 | 92 | 0 |
| Brahmi | 115 | 109 | −6 |
| Kharoshthi | 68 | 65 | −3 |

Devanagari and Siddham match; Brahmi and Kharoshthi were over-counted. The dataset
is now the authority — counts should be read from it, not asserted.

## Evidence

`release/evidence/lipi-unicode-data.json` is regenerated from the file and contains
the full by-category / by-block breakdown, the Indic per-block list, the indic total
(1,597), and the unknown-block count (27,362 — i.e. characters outside our cited
ranges, correctly left UNKNOWN). It records `status: CONTROLLED_NO_GO`.

## Honest limits (PHKD)

- This is **not** a complete Lipi certification.
- 27,362 of 29,215 records fall outside the cited block table and are `UNKNOWN` by
  block. That is correct: we only name blocks we can cite a real range for. Extending
  the block table (with real ranges) is how coverage grows — never by guessing.
- No character meanings, transliterations, or grammar are inferred from this file;
  it provides identity (codepoint, name, category), not semantics.
