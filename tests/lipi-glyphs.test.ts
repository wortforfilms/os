import { test } from "node:test";
import assert from "node:assert/strict";
import { lipiGlyphLibrary, glyphCount, glyphsByScript, glyphCoverage } from "../packages/lipi-runtime/src/glyphs/unicode-glyphs.ts";

test("glyph library contains only real assigned Unicode codepoints", () => {
  assert.ok(glyphCount() > 300, `expected >300 real glyphs, got ${glyphCount()}`);
  for (const g of lipiGlyphLibrary) {
    assert.equal(String.fromCodePoint(g.codepoint), g.char);
    assert.match(g.hex, /^U\+[0-9A-F]{4,}$/);
    assert.ok(/\p{Assigned}/u.test(g.char)); // genuinely assigned, not invented
  }
});

test("per-script counts match real Unicode reality", () => {
  assert.equal(glyphsByScript("brahmi").length, 115);
  assert.equal(glyphsByScript("kharosthi").length, 68);
  assert.equal(glyphsByScript("devanagari").length, 128);
  assert.equal(glyphsByScript("siddham").length, 92);
  assert.equal(glyphCount(), 403);
});

test("coverage is honest: real count is FAR below the fabricated 15,000 claim", () => {
  const c = glyphCoverage();
  assert.equal(c.realGlyphs, 403);
  assert.equal(c.claimed, 15000);
  assert.equal(c.claimSatisfied, false); // the 15,000+ claim is NOT satisfied — honest
  assert.ok(c.realGlyphs < c.claimed / 10);
});
