import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("packages/lipi-runtime/src/data/lipi-426-master.ts", "utf8");
const evidence = JSON.parse(readFileSync("packages/lipi-runtime/release/evidence/lipi-registry-status.json", "utf8"));

test("registry declares a deterministic 426-slot matrix", () => {
  assert.equal(source.includes("426 - canonicalScripts.length"), true);
  assert.equal(evidence.scriptRegistry.expected, 426);
  assert.equal(evidence.scriptRegistry.ingested, 426);
});

test("classical script records exist", () => {
  for (const id of ["brahmi", "kharosthi", "siddham"]) {
    assert.equal(source.includes(`id: "${id}"`), true, `${id} missing`);
  }
});
