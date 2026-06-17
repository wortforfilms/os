import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("zero Unicode timeline is generated for all current revival candidates", () => {
  assert.equal(existsSync("release/evidence/lipi-zero-unicode-timeline.json"), true);
  assert.equal(existsSync("release/LIPI_ZERO_UNICODE_TIMELINE.html"), true);

  const enriched = JSON.parse(readFileSync("data/endangered-scripts-enriched.json", "utf8"));
  const timeline = JSON.parse(readFileSync("release/evidence/lipi-zero-unicode-timeline.json", "utf8"));

  assert.equal(timeline.entries.length, enriched.scripts.length);
  assert.equal(timeline.totals.scripts, enriched.scripts.length);
  assert.equal(timeline.reviewState, "CONTROLLED_NO_GO");
  assert.equal(timeline.governedProductionGo, false);
});

test("timeline keeps every script at zero certification and does not claim revival", () => {
  const timeline = JSON.parse(readFileSync("release/evidence/lipi-zero-unicode-timeline.json", "utf8"));

  assert.equal(timeline.totals.revivedScripts, 0);
  assert.equal(timeline.totals.certifiedCorpusTexts, 0);
  assert.equal(timeline.totals.allScriptsZeroCertified, true);
  for (const entry of timeline.entries) {
    assert.equal(entry.revived, 0);
    assert.equal(entry.certifiedScript, 0);
    assert.equal(entry.certifiedCorpusTexts, 0);
  }
});

test("timeline is sorted by Unicode range start with unencoded samples last", () => {
  const timeline = JSON.parse(readFileSync("release/evidence/lipi-zero-unicode-timeline.json", "utf8"));
  const starts = timeline.entries.map((e) => e.unicodeStart ?? Number.POSITIVE_INFINITY);

  assert.deepEqual(starts, [...starts].sort((a, b) => a - b));
  assert.ok(timeline.totals.unicodeEncoded > 0);
  assert.equal(timeline.totals.unicodeEncoded + timeline.totals.unicodeMissing, timeline.totals.scripts);
});

test("html labels this as Unicode timeline, not historical evolution", () => {
  const html = readFileSync("release/LIPI_ZERO_UNICODE_TIMELINE.html", "utf8");

  assert.match(html, /Unicode-range timeline/);
  assert.match(html, /not a historical evolution timeline/);
  assert.doesNotMatch(html, /ACHIEVED|productionReady:true|governedProductionGo:true/i);
});
