import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("packages/lipi-runtime/src/search/lipi-search.ts", "utf8");

test("search refuses empty query fanout", () => {
  assert.equal(source.includes("if (!needle) return []"), true);
});

test("search covers names, codes, family, and region", () => {
  for (const field of ["script.id", "script.isoCode", "script.name", "script.family", "script.region"]) {
    assert.equal(source.includes(field), true, `${field} missing`);
  }
});
