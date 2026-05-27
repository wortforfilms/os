import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const wall = JSON.parse(readFileSync("data/maataa-ecosystem-wall.json", "utf8"));

test("ecosystem wall captures the extracted domain layout", () => {
  assert.equal(wall.topDomains.length, 5);
  assert.equal(wall.bottomDomains.length, 4);
  assert.equal(wall.foundationLayers.length, 7);
  assert.equal(wall.technologyFoundation.length, 12);
});

test("ecosystem wall includes the central KBM and Maataa engines", () => {
  assert.equal(wall.center.kbm.title, "KBM");
  assert.equal(wall.center.maataa.title, "Maataa");
  assert.equal(wall.center.tlp.title, "TLP");
});

test("ecosystem wall keeps preview claims honest", () => {
  assert.equal(wall.source.verifiedImplementation, false);
  assert.equal(wall.governance.productionReady, false);
  assert.equal(wall.governance.finalStatus, "GOVERNED_PRODUCTION_NO_GO");
});

test("blocked domains include explicit blocked reason", () => {
  const blocked = [...wall.topDomains, ...wall.bottomDomains].filter((domain) => domain.status === "BLOCKED");
  assert.equal(blocked.length >= 1, true);
  for (const domain of blocked) {
    assert.equal(typeof domain.blockedReason, "string");
    assert.equal(domain.blockedReason.length > 0, true);
  }
});
