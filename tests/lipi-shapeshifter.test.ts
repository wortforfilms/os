import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  buildShiftIndex, observeShift, shiftSets, relationGraph, letterToken, resetShapeshifter,
} from "../packages/lipi-runtime/src/shapeshifter.ts";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "unicode", "UnicodeData.txt");

test("letterToken extracts the phonetic token from a Unicode name", () => {
  assert.equal(letterToken("DEVANAGARI LETTER KA"), "KA");
  assert.equal(letterToken("BENGALI LETTER A"), "A");
  assert.equal(letterToken("DEVANAGARI SIGN ANUSVARA"), null); // not a LETTER
});

test("buildShiftIndex indexes real Brahmic letters", () => {
  resetShapeshifter();
  const r = buildShiftIndex(DATA);
  assert.ok(r.tokens > 50);
  assert.ok(r.variants > 500);
});

test("observeShift: KA shapeshifts across many scripts (real shapes)", () => {
  buildShiftIndex(DATA);
  const ka = observeShift("KA");
  assert.ok(ka.scripts >= 6, `KA spans >=6 scripts, got ${ka.scripts}`);
  const scripts = ka.variants.map((v) => v.script);
  assert.ok(scripts.includes("Devanagari"));
  assert.ok(scripts.includes("Bengali"));
  // each variant carries only file-derived identity — no invented meaning
  const dev = ka.variants.find((v) => v.script === "Devanagari");
  assert.equal(dev.name, "DEVANAGARI LETTER KA");
  assert.equal(dev.char, String.fromCodePoint(dev.codepoint));
  assert.equal("meaning" in dev, false);
});

test("observeShift is fail-closed on an unknown token", () => {
  buildShiftIndex(DATA);
  const miss = observeShift("ZZZNOPE");
  assert.equal(miss.variants.length, 0);
  assert.equal(miss.scripts, 0);
});

test("shiftSets returns cross-script correspondences ranked by spread", () => {
  buildShiftIndex(DATA);
  const sets = shiftSets(2);
  assert.ok(sets.length > 30);
  // sorted: first has the widest script spread
  assert.ok(sets[0].scripts >= sets[sets.length - 1].scripts);
  assert.ok(sets.every((s) => s.scripts >= 2));
});

test("relationGraph is a real bipartite token<->script graph; NO_GO", () => {
  buildShiftIndex(DATA);
  const g = relationGraph();
  assert.equal(g.schema, "maataa.lipi.relation-mind-graph.v1");
  assert.ok(g.nodes.tokens > 50);
  assert.ok(g.nodes.scripts >= 10);
  assert.ok(g.edges > 500);
  assert.equal(g.status, "CONTROLLED_NO_GO");
  assert.equal(g.governedProductionGo, false);
});

test("not-built state fails closed", () => {
  resetShapeshifter();
  assert.throws(() => observeShift("KA"), /not built/);
});
