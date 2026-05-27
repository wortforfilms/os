import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("packages/lipi-runtime/src/lineage/script-lineage-graph.ts", "utf8");

test("lineage graph includes governed classical edges", () => {
  assert.equal(source.includes("brahmi-to-siddham"), true);
  assert.equal(source.includes("sharada-to-landa"), true);
});

test("lineage edges carry evidence caveats", () => {
  assert.equal(source.includes("evidence bundle"), true);
});
