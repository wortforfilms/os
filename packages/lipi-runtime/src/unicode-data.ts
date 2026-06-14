/*
 * @maataa/lipi-runtime — local Unicode authority dataset.
 *
 * Absorbs the official UnicodeData.txt as a repo-local source of truth for Lipi.
 *
 * PHKD RULES honored here:
 *  - We DO NOT claim complete Lipi certification. Status stays CONTROLLED_NO_GO.
 *  - We DO NOT invent character meanings — only the fields present in the file are used.
 *  - Script/block is UNKNOWN unless it falls inside a REAL Unicode block range (table below).
 *  - Counts are computed from the file at load time, never hardcoded.
 *  - Fail-closed: unknown codepoints / not-loaded state return misses, not guesses.
 */
import { readFileSync } from "node:fs";

// ---------- record shape (only fields present in UnicodeData.txt) ----------
export interface UnicodeRecord {
  codepoint: number;          // numeric
  hex: string;                // zero-padded uppercase hex, e.g. "0905"
  name: string;               // field 1, verbatim
  category: string;           // field 2 (General_Category)
  combiningClass: number;     // field 3
  bidiClass: string;          // field 4
  decomposition: string;      // field 5 (verbatim, not interpreted)
  numericDecimal: string;     // field 6
  numericDigit: string;       // field 7
  numericValue: string;       // field 8
  bidiMirrored: boolean;      // field 9 (Y/N)
  uppercase: string;          // field 12
  lowercase: string;          // field 13
  titlecase: string;          // field 14
  block: string;              // DERIVED from real range table, else "UNKNOWN"
}

// ---------- REAL Unicode block ranges (subset; extend as needed) ----------
// Source: Unicode block definitions. Only ranges we can cite are listed; anything
// outside these is reported as block "UNKNOWN" (never invented).
export const UNICODE_BLOCKS: ReadonlyArray<{ name: string; start: number; end: number; indic?: boolean }> = [
  { name: "Basic Latin", start: 0x0000, end: 0x007f },
  { name: "Latin-1 Supplement", start: 0x0080, end: 0x00ff },
  { name: "Devanagari", start: 0x0900, end: 0x097f, indic: true },
  { name: "Bengali", start: 0x0980, end: 0x09ff, indic: true },
  { name: "Gurmukhi", start: 0x0a00, end: 0x0a7f, indic: true },
  { name: "Gujarati", start: 0x0a80, end: 0x0aff, indic: true },
  { name: "Oriya", start: 0x0b00, end: 0x0b7f, indic: true },
  { name: "Tamil", start: 0x0b80, end: 0x0bff, indic: true },
  { name: "Telugu", start: 0x0c00, end: 0x0c7f, indic: true },
  { name: "Kannada", start: 0x0c80, end: 0x0cff, indic: true },
  { name: "Malayalam", start: 0x0d00, end: 0x0d7f, indic: true },
  { name: "Sinhala", start: 0x0d80, end: 0x0dff, indic: true },
  { name: "Devanagari Extended", start: 0xa8e0, end: 0xa8ff, indic: true },
  { name: "Vedic Extensions", start: 0x1cd0, end: 0x1cff, indic: true },
  { name: "Kharoshthi", start: 0x10a00, end: 0x10a5f, indic: true },
  { name: "Brahmi", start: 0x11000, end: 0x1107f, indic: true },
  { name: "Sharada", start: 0x11180, end: 0x111df, indic: true },
  { name: "Grantha", start: 0x11300, end: 0x1137f, indic: true },
  { name: "Siddham", start: 0x11580, end: 0x115ff, indic: true },
  { name: "Modi", start: 0x11600, end: 0x1165f, indic: true },
  { name: "Tirhuta", start: 0x11480, end: 0x114df, indic: true },
];

export function blockOf(codepoint: number): string {
  for (const b of UNICODE_BLOCKS) if (codepoint >= b.start && codepoint <= b.end) return b.name;
  return "UNKNOWN";
}

const toHex = (n: number) => n.toString(16).toUpperCase().padStart(4, "0");

/** Parse ONE UnicodeData.txt line. Returns null for blank lines. Only present fields used. */
export function parseUnicodeDataLine(line: string): UnicodeRecord | null {
  if (line == null) return null;
  const trimmed = line.replace(/\r?\n$/, "");
  if (trimmed.trim() === "") return null;
  const f = trimmed.split(";");
  if (f.length < 15) return null; // malformed → fail closed (skip)
  const codepoint = parseInt(f[0], 16);
  if (!Number.isFinite(codepoint)) return null;
  const combining = parseInt(f[3], 10);
  return {
    codepoint,
    hex: toHex(codepoint),
    name: f[1],
    category: f[2],
    combiningClass: Number.isFinite(combining) ? combining : 0,
    bidiClass: f[4],
    decomposition: f[5],
    numericDecimal: f[6],
    numericDigit: f[7],
    numericValue: f[8],
    bidiMirrored: f[9] === "Y",
    uppercase: f[12],
    lowercase: f[13],
    titlecase: f[14],
    block: blockOf(codepoint),
  };
}

// ---------- module dataset state (set by loadUnicodeData) ----------
let RECORDS: UnicodeRecord[] = [];
let BY_CP: Map<number, UnicodeRecord> = new Map();
let SOURCE = "";

export function resetUnicodeData(): void { RECORDS = []; BY_CP = new Map(); SOURCE = ""; }

export interface LoadResult { count: number; source: string }

/** Load + index UnicodeData.txt from `path`. Reads only; computes nothing fabricated. */
export function loadUnicodeData(path: string): LoadResult {
  const raw = readFileSync(path, "utf8");
  const recs: UnicodeRecord[] = [];
  for (const line of raw.split("\n")) {
    const r = parseUnicodeDataLine(line);
    if (r) recs.push(r);
  }
  RECORDS = recs;
  BY_CP = new Map(recs.map((r) => [r.codepoint, r]));
  SOURCE = path;
  return { count: recs.length, source: path };
}

function ensureLoaded(): void {
  if (RECORDS.length === 0) throw new Error("unicode-data: not loaded — call loadUnicodeData(path) first (fail-closed)");
}

const normCp = (cp: number | string): number =>
  typeof cp === "number" ? cp : parseInt(String(cp).replace(/^(U\+|0x)/i, ""), 16);

/** Lookup by codepoint (number or hex string). Returns null on a miss (fail-closed). */
export function getCharacterByCodepoint(codepoint: number | string): UnicodeRecord | null {
  ensureLoaded();
  const cp = normCp(codepoint);
  if (!Number.isFinite(cp)) return null;
  return BY_CP.get(cp) ?? null;
}

/** Case-insensitive substring search over the verbatim Name field. */
export function searchUnicodeByName(query: string): UnicodeRecord[] {
  ensureLoaded();
  if (!query || typeof query !== "string") return [];
  const q = query.toUpperCase();
  return RECORDS.filter((r) => r.name.toUpperCase().includes(q));
}

/** All records with start <= codepoint <= end (inclusive). Accepts numbers or hex. */
export function listByRange(start: number | string, end: number | string): UnicodeRecord[] {
  ensureLoaded();
  const a = normCp(start), b = normCp(end);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a > b) return [];
  return RECORDS.filter((r) => r.codepoint >= a && r.codepoint <= b);
}

export const listDevanagari = (): UnicodeRecord[] => listByRange(0x0900, 0x097f);
export const listGurmukhi = (): UnicodeRecord[] => listByRange(0x0a00, 0x0a7f);

export interface IndicScriptSummary { block: string; start: string; end: string; count: number }

/** Per-Indic-block counts, computed from the file. */
export function listIndicScripts(): IndicScriptSummary[] {
  ensureLoaded();
  return UNICODE_BLOCKS.filter((b) => b.indic).map((b) => ({
    block: b.name, start: toHex(b.start), end: toHex(b.end),
    count: RECORDS.filter((r) => r.codepoint >= b.start && r.codepoint <= b.end).length,
  }));
}

export interface UnicodeSummary {
  schema: "maataa.lipi.unicode-data.v1";
  source: string;
  totalRecords: number;
  byCategory: Record<string, number>;
  byBlock: Record<string, number>;
  indicTotal: number;
  unknownBlock: number;
  generated: true;
  governedProductionGo: false;
  status: "CONTROLLED_NO_GO";
}

/** Summary — every number is computed from the loaded file, never hardcoded. */
export function summarizeUnicodeData(): UnicodeSummary {
  ensureLoaded();
  const byCategory: Record<string, number> = {};
  const byBlock: Record<string, number> = {};
  for (const r of RECORDS) {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
    byBlock[r.block] = (byBlock[r.block] ?? 0) + 1;
  }
  const indicBlocks = new Set(UNICODE_BLOCKS.filter((b) => b.indic).map((b) => b.name));
  const indicTotal = Object.entries(byBlock).reduce((n, [b, c]) => n + (indicBlocks.has(b) ? c : 0), 0);
  return {
    schema: "maataa.lipi.unicode-data.v1",
    source: SOURCE,
    totalRecords: RECORDS.length,
    byCategory, byBlock,
    indicTotal,
    unknownBlock: byBlock["UNKNOWN"] ?? 0,
    generated: true,
    governedProductionGo: false,
    status: "CONTROLLED_NO_GO",
  };
}
