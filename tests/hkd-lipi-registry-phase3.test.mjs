import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const numeral = JSON.parse(readFileSync("data/hkd-lipi-numeral-registry.json", "utf8"));
const zero = JSON.parse(readFileSync("data/hkd-lipi-zero-registry.json", "utf8"));
const crosswalk = JSON.parse(readFileSync("data/hkd-lipi-unicode-crosswalk.json", "utf8"));
const family = JSON.parse(readFileSync("data/hkd-lipi-script-family-graph.json", "utf8"));
const evidence = JSON.parse(readFileSync("release/evidence/hkd-lipi-registry-phase3-enrichment.json", "utf8"));

const aliases = readFileSync("data/unicode/ucd-latest/PropertyValueAliases.txt", "utf8")
  .split(/\r?\n/)
  .filter((line) => /^sc\s*;/.test(line))
  .map((line) => line.split("#")[0].split(";").map((part) => part.trim()).filter(Boolean));
const aliasByScript = new Map(aliases.map((parts) => [parts[2], parts[1]]));

const scriptRangesByScript = new Map();
for (const line of readFileSync("data/unicode/ucd-latest/Scripts.txt", "utf8").split(/\r?\n/)) {
  const clean = line.split("#")[0].trim();
  if (!clean || !clean.includes(";")) continue;
  const [range, script] = clean.split(";").map((part) => part.trim());
  if (!scriptRangesByScript.has(script)) scriptRangesByScript.set(script, new Set());
  scriptRangesByScript.get(script).add(normalizeRange(range));
}

test("every Unicode decimal script has digits 0-9", () => {
  assert.equal(numeral.summary.decimalScriptCount, 63);
  assert.equal(numeral.summary.incompleteDigitSetScripts.length, 0);

  for (const record of numeral.records) {
    assert.equal(record.digits_0_9.length, 10, record.scriptValue);
    assert.deepEqual(
      record.digits_0_9.map((digit) => digit.value),
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      record.scriptValue,
    );
    assert.equal(record.allValuesPresent, true, record.scriptValue);
  }
});

test("every decimal script has a zero glyph", () => {
  assert.equal(zero.records.length, numeral.records.length);
  assert.equal(zero.summary.missingZeroGlyphScripts.length, 0);

  for (const record of zero.records) {
    assert.notEqual(record.zeroGlyph, "UNKNOWN", record.scriptValue);
    assert.match(record.zeroCodePoint, /^U\+[0-9A-F]{4,6}$/);
  }
});

test("no ISO 15924 value is invented beyond Unicode script aliases", () => {
  assert.equal(crosswalk.records.length, aliases.length);
  for (const record of crosswalk.records) {
    assert.equal(record.iso15924, aliasByScript.get(record.unicodeScriptValue), record.unicodeScriptValue);
  }
});

test("no Unicode ranges are invented beyond Scripts.txt", () => {
  for (const record of crosswalk.records) {
    const officialRanges = scriptRangesByScript.get(record.unicodeScriptValue) ?? new Set();
    for (const range of record.unicodeRanges) {
      assert.equal(officialRanges.has(range), true, `${record.unicodeScriptValue} ${range}`);
    }
  }
});

test("provenance exists for every enrichment and runtime remains controlled no-go", () => {
  assert.equal(evidence.productionReady, false);
  assert.equal(evidence.runtimeEnabled, 0);
  assert.equal(evidence.phkdVerdict, "CONTROLLED_NO_GO");
  assert.equal(evidence.checks.everyEnrichmentHasProvenance, true);

  for (const record of numeral.records) assert.ok(record.provenance, record.scriptValue);
  for (const record of zero.records) assert.ok(record.provenance, record.scriptValue);
  for (const record of crosswalk.records) {
    assert.ok(record.provenance, record.unicodeScriptValue);
    assert.ok(record.fontSupportMetadata.provenance, record.unicodeScriptValue);
    assert.ok(record.transliterationMetadata.provenance, record.unicodeScriptValue);
  }
  for (const record of family.nodes.scripts) assert.ok(record.provenance, record.unicodeScriptValue);
  for (const edge of family.edges.scriptBlockEdges) assert.ok(edge.provenance, `${edge.from}:${edge.to}`);
});

test("font, transliteration, and genealogical family gaps are explicit unknowns, not fake data", () => {
  assert.equal(crosswalk.summary.fontSupportKnownRows, 0);
  assert.equal(crosswalk.summary.transliterationKnownRows, 0);
  assert.equal(family.summary.genealogicalFamilyEdges, 0);
  assert.match(family.summary.blockedReason, /Unicode UCD defines Script properties and blocks/);
});

function normalizeRange(range) {
  const [start, end = start] = range.split("..");
  const left = `U+${Number.parseInt(start, 16).toString(16).toUpperCase().padStart(4, "0")}`;
  const right = `U+${Number.parseInt(end, 16).toString(16).toUpperCase().padStart(4, "0")}`;
  return left === right ? left : `${left}-${right}`;
}
