import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadUnicodeData } from "../packages/lipi-runtime/src/unicode-data.ts";
import {
  buildDevanagariIpa, devanagariToIpa, devanagariIpaCoverage, resetDevanagariIpa,
} from "../packages/lipi-runtime/src/devanagari-ipa.ts";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "unicode", "UnicodeData.txt");
const setup = () => { loadUnicodeData(DATA); buildDevanagariIpa(); };

test("devanagariToIpa maps base aksharas to standard IPA (review-pending)", () => {
  setup();
  const ka = devanagariToIpa("क");
  assert.equal(ka.ipa, "kə");
  assert.equal(ka.name, "DEVANAGARI LETTER KA");
  assert.equal(ka.status, "NEEDS_NATIVE_REVIEW"); // never certified
  assert.equal(devanagariToIpa("अ").ipa, "ə");
  assert.equal(devanagariToIpa("ख").ipa, "kʰə");
  assert.equal(devanagariToIpa("ग").ipa, "ɡə");
  assert.equal(devanagariToIpa("ण").ipa, "ɳə");   // retroflex nasal
  assert.equal(devanagariToIpa("श").ipa, "ʃə");   // palatal sibilant
  assert.equal(devanagariToIpa(0x0939).ipa, "ɦə"); // HA by codepoint
});

test("every mapped record cites provenance and is review-pending", () => {
  setup();
  const cov = devanagariIpaCoverage();
  for (const r of cov.records) {
    if (r.ipa !== null) {
      assert.equal(r.status, "NEEDS_NATIVE_REVIEW");
      assert.ok(r.source && r.source.includes("ISO 15919"));
    } else {
      assert.equal(r.status, "UNKNOWN");
      assert.equal(r.source, null);
    }
  }
  assert.equal(cov.status, "CONTROLLED_NO_GO");
  assert.equal(cov.governedProductionGo, false);
});

test("unmapped Devanagari signs/marks are UNKNOWN, not invented", () => {
  setup();
  // ANUSVARA (sign, not a base letter) — not a LETTER, excluded from records
  assert.equal(devanagariToIpa("ं"), null);
  // a Devanagari digit is not a base akshara letter → null
  assert.equal(devanagariToIpa("०"), null);
});

test("coverage reports real mapped vs unknown counts", () => {
  setup();
  const cov = devanagariIpaCoverage();
  assert.ok(cov.mapped >= 40, `expected the ~45 base aksharas mapped, got ${cov.mapped}`);
  assert.equal(cov.mapped + cov.unknown, cov.letters);
  assert.equal(cov.range, "0900..097F");
});

test("not-built state fails closed", () => {
  resetDevanagariIpa();
  assert.throws(() => devanagariToIpa("क"), /not built/);
});
