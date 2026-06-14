import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildGlyphLibrary, ingestGlyphs, glyphCoverage,
  LEGACY_CLAIM_TOTAL, FABRICATED_TARGET,
} from "../packages/lipi-runtime/src/glyph-ingestion.ts";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "unicode", "UnicodeData.txt");

test("buildGlyphLibrary ingests real Brahmic glyphs with provenance", () => {
  const lib = buildGlyphLibrary(DATA);
  assert.equal(lib.schema, "maataa.lipi.glyph-library.v1");
  assert.ok(lib.total > 1000, "Brahmic family is >1000 glyphs");
  assert.match(lib.sourceSha256, /^[0-9a-f]{64}$/);
  assert.equal(lib.provenance.meaningsInvented, false);
  assert.equal(lib.status, "CONTROLLED_NO_GO");
  assert.equal(lib.governedProductionGo, false);
});

test("ingested glyphs carry only file-derived identity (no invented meaning)", () => {
  const lib = buildGlyphLibrary(DATA);
  const a = lib.glyphs.find((g) => g.codepoint === 0x0905);
  assert.equal(a.name, "DEVANAGARI LETTER A");
  assert.equal(a.script, "Devanagari");
  assert.equal(a.hex, "0905");
  assert.equal(a.char, String.fromCodePoint(0x0905)); // faithful render
  assert.equal(a.category, "Lo");
  // no "meaning"/"definition" field exists on a glyph
  assert.equal("meaning" in a, false);
  assert.equal("definition" in a, false);
});

test("counts are generated from the file (per-script sums equal total)", () => {
  const lib = buildGlyphLibrary(DATA);
  const sum = lib.scripts.reduce((n, s) => n + s.count, 0);
  assert.equal(sum, lib.total);
  const dev = lib.scripts.find((s) => s.script === "Devanagari");
  assert.equal(dev.count, lib.glyphs.filter((g) => g.script === "Devanagari").length);
});

test("category filter ingests letters only when requested", () => {
  const all = buildGlyphLibrary(DATA).total;
  const lettersOnly = ingestGlyphs({ categories: ["Lo", "Lu", "Ll"] }).length;
  assert.ok(lettersOnly > 0);
  assert.ok(lettersOnly < all, "letters-only is a strict subset of all glyphs");
});

test("glyphCoverage is honest about the fabricated 15,000 target", () => {
  const lib = buildGlyphLibrary(DATA);
  const cov = glyphCoverage(lib);
  assert.equal(cov.fabricatedTarget, FABRICATED_TARGET);
  assert.equal(cov.claimSatisfied, false);
  assert.equal(cov.gapToFabricatedTarget, FABRICATED_TARGET - lib.total);
  assert.ok(cov.gapToFabricatedTarget > 10000, "still far below the fabricated target — stated plainly");
  assert.equal(cov.status, "CONTROLLED_NO_GO");
});

test("legacy 403 claim is reconciled against ingestion (Brahmi/Kharoshthi over-counted)", () => {
  const lib = buildGlyphLibrary(DATA);
  const cov = glyphCoverage(lib);
  const by = Object.fromEntries(cov.legacyReconciliation.map((r) => [r.script, r]));
  assert.equal(by.Devanagari.delta, 0);
  assert.equal(by.Siddham.delta, 0);
  assert.ok(by.Brahmi.delta < 0, "Brahmi was over-claimed");
  assert.ok(by.Kharoshthi.delta < 0, "Kharoshthi was over-claimed");
  const legacySum = cov.legacyReconciliation.reduce((n, r) => n + r.ingested, 0);
  assert.notEqual(legacySum, LEGACY_CLAIM_TOTAL); // the old 403 was not accurate
});
