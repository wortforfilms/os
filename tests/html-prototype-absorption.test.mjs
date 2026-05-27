import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const inventory = JSON.parse(readFileSync("data/html-prototype-inventory.json", "utf8"));

test("all external HTML prototypes are represented", () => {
  assert.equal(inventory.prototypes.length, 13);
  assert.equal(inventory.counts.files, 13);
  assert.equal(inventory.counts.sourceLines, 9549);
});

test("absorption captures all requested contract categories", () => {
  for (const prototype of inventory.prototypes) {
    for (const field of ["frames", "types", "schemas", "dataFrames", "runtimes", "workflows", "ui", "widgets"]) {
      assert.equal(Array.isArray(prototype[field]), true, `${prototype.id}.${field} must be an array`);
      assert.equal(prototype[field].length > 0, true, `${prototype.id}.${field} must not be empty`);
    }
  }
});

test("blocked prototype surfaces include explicit reasons", () => {
  const blocked = inventory.prototypes.filter((prototype) => prototype.status === "BLOCKED");
  assert.equal(blocked.length > 0, true);
  for (const prototype of blocked) {
    assert.equal(typeof prototype.blockedReason, "string");
    assert.equal(prototype.blockedReason.length > 0, true);
  }
});

test("raw prototype policy keeps local HTML out of release sources", () => {
  assert.equal(inventory.rawPrototypePolicy.rawHtmlTrackedInRepo, false);
  assert.equal(inventory.rawPrototypePolicy.assetsHtmlTouched, false);
  assert.equal(inventory.rawPrototypePolicy.productionBuildInput, false);
});

test("PHKD state remains governed no-go", () => {
  assert.equal(inventory.governance.productionReady, false);
  assert.equal(inventory.governance.phkdVerdict, "BLOCKED");
  assert.equal(inventory.governance.finalStatus, "GOVERNED_PRODUCTION_NO_GO");
  assert.equal(inventory.governance.noFakeClaims, true);
});
