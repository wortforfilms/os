import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseUnicodeDataLine, loadUnicodeData, resetUnicodeData,
  getCharacterByCodepoint, searchUnicodeByName, listByRange,
  listDevanagari, listGurmukhi, listIndicScripts, summarizeUnicodeData, blockOf,
} from "../packages/lipi-runtime/src/unicode-data.ts";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "unicode", "UnicodeData.txt");

test("parses LATIN CAPITAL LETTER A", () => {
  const r = parseUnicodeDataLine("0041;LATIN CAPITAL LETTER A;Lu;0;L;;;;;N;;;;0061;");
  assert.equal(r.name, "LATIN CAPITAL LETTER A");
  assert.equal(r.hex, "0041");
  assert.equal(r.category, "Lu");
  assert.equal(r.lowercase, "0061");
  assert.equal(r.block, "Basic Latin");
});

test("parses DEVANAGARI LETTER A", () => {
  const r = parseUnicodeDataLine("0905;DEVANAGARI LETTER A;Lo;0;L;;;;;N;;;;;");
  assert.equal(r.name, "DEVANAGARI LETTER A");
  assert.equal(r.codepoint, 0x0905);
  assert.equal(r.block, "Devanagari");
});

test("parses DEVANAGARI LETTER KA", () => {
  const r = parseUnicodeDataLine("0915;DEVANAGARI LETTER KA;Lo;0;L;;;;;N;;;;;");
  assert.equal(r.name, "DEVANAGARI LETTER KA");
  assert.equal(r.hex, "0915");
  assert.equal(r.block, "Devanagari");
});

test("parses GURMUKHI LETTER A", () => {
  const r = parseUnicodeDataLine("0A05;GURMUKHI LETTER A;Lo;0;L;;;;;N;;;;;");
  assert.equal(r.name, "GURMUKHI LETTER A");
  assert.equal(r.block, "Gurmukhi");
});

test("parseUnicodeDataLine: blank/malformed lines fail closed (null)", () => {
  assert.equal(parseUnicodeDataLine(""), null);
  assert.equal(parseUnicodeDataLine("   "), null);
  assert.equal(parseUnicodeDataLine("0041;too;few;fields"), null);
});

test("block is UNKNOWN when outside a real Unicode range", () => {
  // 0x2FFF is unassigned and outside every block in our cited table
  assert.equal(blockOf(0x2fff), "UNKNOWN");
});

test("range 0900-097F returns Devanagari records from the file", () => {
  resetUnicodeData();
  loadUnicodeData(DATA);
  const recs = listByRange("0900", "097F");
  assert.ok(recs.length > 0);
  assert.ok(recs.every((r) => r.codepoint >= 0x0900 && r.codepoint <= 0x097f));
  assert.ok(recs.some((r) => r.name === "DEVANAGARI LETTER A"));
  assert.ok(recs.some((r) => r.name === "DEVANAGARI LETTER KA"));
  // listDevanagari is the same range
  assert.equal(listDevanagari().length, recs.length);
  assert.ok(listGurmukhi().some((r) => r.name === "GURMUKHI LETTER A"));
});

test("getCharacterByCodepoint resolves real codepoints (hex + number)", () => {
  loadUnicodeData(DATA);
  assert.equal(getCharacterByCodepoint("0905").name, "DEVANAGARI LETTER A");
  assert.equal(getCharacterByCodepoint(0x0041).name, "LATIN CAPITAL LETTER A");
  assert.equal(getCharacterByCodepoint("U+0915").name, "DEVANAGARI LETTER KA");
});

test("unknown codepoint fails closed (null, no fabrication)", () => {
  loadUnicodeData(DATA);
  // 0x0978 was unassigned in older Unicode; pick a guaranteed-unassigned PUA-adjacent gap
  const miss = getCharacterByCodepoint("FFFFF");
  assert.equal(miss, null);
});

test("searchUnicodeByName finds by verbatim name substring", () => {
  loadUnicodeData(DATA);
  const hits = searchUnicodeByName("DEVANAGARI LETTER KA");
  assert.ok(hits.some((r) => r.name === "DEVANAGARI LETTER KA"));
  assert.equal(searchUnicodeByName("").length, 0);
});

test("summary counts are generated from file, not hardcoded", () => {
  loadUnicodeData(DATA);
  const s = summarizeUnicodeData();
  // totalRecords must equal the number of parseable lines we actually loaded
  const reloaded = loadUnicodeData(DATA).count;
  assert.equal(s.totalRecords, reloaded);
  assert.ok(s.totalRecords > 20000, "real UCD has tens of thousands of records");
  assert.equal(s.status, "CONTROLLED_NO_GO");
  assert.equal(s.governedProductionGo, false);
  // Devanagari block count must match the live range query (proves not hardcoded)
  assert.equal(s.byBlock["Devanagari"], listDevanagari().length);
  // Indic per-block summary is also live
  const dev = listIndicScripts().find((b) => b.block === "Devanagari");
  assert.equal(dev.count, listDevanagari().length);
});

test("not-loaded state fails closed", () => {
  resetUnicodeData();
  assert.throws(() => getCharacterByCodepoint("0905"), /not loaded/);
});
