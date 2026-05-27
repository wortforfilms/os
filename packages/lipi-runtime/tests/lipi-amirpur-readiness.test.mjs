import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readiness = JSON.parse(readFileSync("packages/lipi-runtime/release/evidence/lipi-amirpur-readiness.json", "utf8"));

test("Amirpur profile includes Hindi, Haryanvi, and Punjabi", () => {
  assert.deepEqual(readiness.languages, ["hi", "hr", "pa"]);
});

test("Amirpur profile remains governed no-go", () => {
  assert.equal(readiness.productionReady, false);
  assert.equal(readiness.finalStatus, "GOVERNED_PRODUCTION_NO_GO");
});
