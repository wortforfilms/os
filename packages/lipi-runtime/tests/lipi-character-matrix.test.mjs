import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("packages/lipi-runtime/src/characters/token-anchors.ts", "utf8");

test("character anchors include seeded Brahmi, Kharosthi, and Siddham anchors", () => {
  for (const id of ["brahmi-a", "brahmi-ka", "kharosthi-a", "siddham-a"]) {
    assert.equal(source.includes(`id: "${id}"`), true, `${id} missing`);
  }
});

test("anchors are not marked as certified", () => {
  assert.equal(source.includes("ANCHOR_VERIFIED"), false);
});
