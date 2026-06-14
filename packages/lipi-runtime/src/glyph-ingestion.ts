/*
 * @maataa/lipi-runtime — real glyph ingestion from the local Unicode authority.
 *
 * Turns data/unicode/UnicodeData.txt into a Lipi glyph library for the Brahmic /
 * Indic scripts, with full provenance. This REPLACES the prior hardcoded 403-glyph
 * library: every glyph and every count is derived from the file at ingestion time.
 *
 * PHKD:
 *  - No invented meanings. A glyph carries only file-derived identity: codepoint,
 *    rendered char (String.fromCodePoint), verbatim Name, General_Category, and the
 *    block (derived from a real Unicode range, else excluded — we only ingest cited
 *    Indic blocks here).
 *  - Counts generated from the file, never hardcoded.
 *  - Evidence lineage: the source file's SHA-256 is recorded with the library.
 *  - Lipi certification NOT claimed. Status CONTROLLED_NO_GO.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { UNICODE_BLOCKS, loadUnicodeData, listByRange } from "./unicode-data.ts";

export interface Glyph {
  codepoint: number;
  hex: string;
  char: string;        // String.fromCodePoint(codepoint) — faithful rendering, not a meaning
  name: string;        // verbatim UCD Name
  category: string;    // General_Category (e.g. Lo, Mn, Mc, Nd)
  script: string;      // Brahmic block name (real range)
}

export interface GlyphLibrary {
  schema: "maataa.lipi.glyph-library.v1";
  generated: true;
  source: string;
  sourceSha256: string;
  scripts: Array<{ script: string; range: string; count: number }>;
  total: number;
  glyphs: Glyph[];
  provenance: {
    derivedFrom: "UnicodeData.txt";
    fields: string[];
    meaningsInvented: false;
  };
  governedProductionGo: false;
  status: "CONTROLLED_NO_GO";
}

const toHex = (n: number) => n.toString(16).toUpperCase().padStart(4, "0");
const indicBlocks = () => UNICODE_BLOCKS.filter((b) => b.indic);

/**
 * Ingest glyphs for all cited Indic blocks from the already-loaded dataset.
 * Optionally restrict to a set of General_Category values (e.g. only letters).
 */
export function ingestGlyphs(opts: { categories?: string[] } = {}): Glyph[] {
  const cats = opts.categories ? new Set(opts.categories) : null;
  const out: Glyph[] = [];
  for (const b of indicBlocks()) {
    for (const r of listByRange(b.start, b.end)) {
      if (cats && !cats.has(r.category)) continue;
      out.push({
        codepoint: r.codepoint,
        hex: r.hex,
        char: String.fromCodePoint(r.codepoint),
        name: r.name,
        category: r.category,
        script: b.name,
      });
    }
  }
  return out;
}

/** Build the full glyph library from a UnicodeData.txt path (loads + ingests + hashes). */
export function buildGlyphLibrary(path: string, opts: { categories?: string[] } = {}): GlyphLibrary {
  const raw = readFileSync(path, "utf8");
  const sourceSha256 = createHash("sha256").update(raw).digest("hex");
  loadUnicodeData(path);
  const glyphs = ingestGlyphs(opts);
  const scripts = indicBlocks().map((b) => ({
    script: b.name,
    range: `${toHex(b.start)}..${toHex(b.end)}`,
    count: glyphs.filter((g) => g.script === b.name).length,
  }));
  return {
    schema: "maataa.lipi.glyph-library.v1",
    generated: true,
    source: path,
    sourceSha256,
    scripts,
    total: glyphs.length,
    glyphs,
    provenance: {
      derivedFrom: "UnicodeData.txt",
      fields: ["codepoint", "name", "category", "block-range"],
      meaningsInvented: false,
    },
    governedProductionGo: false,
    status: "CONTROLLED_NO_GO",
  };
}

// The prior in-memory library's hardcoded per-script claims (to be reconciled).
export const LEGACY_GLYPH_CLAIM: Record<string, number> = {
  Brahmi: 115, Kharoshthi: 68, Devanagari: 128, Siddham: 92,
};
export const LEGACY_CLAIM_TOTAL = 403;
export const FABRICATED_TARGET = 15000;

export interface GlyphCoverage {
  schema: "maataa.lipi.glyph-coverage.v1";
  total: number;
  perScript: Record<string, number>;
  fabricatedTarget: number;
  claimSatisfied: false;
  gapToFabricatedTarget: number;
  legacyReconciliation: Array<{ script: string; claimed: number; ingested: number; delta: number }>;
  governedProductionGo: false;
  status: "CONTROLLED_NO_GO";
}

/** Coverage report derived from a built library. Honest about the 15,000 target. */
export function glyphCoverage(lib: GlyphLibrary): GlyphCoverage {
  const perScript: Record<string, number> = {};
  for (const s of lib.scripts) perScript[s.script] = s.count;
  const legacyReconciliation = Object.entries(LEGACY_GLYPH_CLAIM).map(([script, claimed]) => ({
    script, claimed, ingested: perScript[script] ?? 0, delta: (perScript[script] ?? 0) - claimed,
  }));
  return {
    schema: "maataa.lipi.glyph-coverage.v1",
    total: lib.total,
    perScript,
    fabricatedTarget: FABRICATED_TARGET,
    claimSatisfied: false,
    gapToFabricatedTarget: FABRICATED_TARGET - lib.total,
    legacyReconciliation,
    governedProductionGo: false,
    status: "CONTROLLED_NO_GO",
  };
}
