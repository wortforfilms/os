import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("release/FULL_DEMO.html", "utf8");
const evidence = JSON.parse(readFileSync("release/evidence/full-demo.json", "utf8"));

test("full demo artifact contains governed no-go status", () => {
  assert.equal(html.includes("Maataa OS Full Demo"), true);
  assert.equal(html.includes("GOVERNED_PRODUCTION_NO_GO"), true);
  assert.equal(html.includes("PRODUCTION_READY = FALSE"), true);
});

test("full demo includes all major static preview surfaces", () => {
  for (const marker of ["Aam Jantaa", "Runtime Health", "Lipi Runtime", "Support Center", "Maataa Ecosystem Wall", "Merkle Data Tree", "ThemeLab", "Runtime HTML"]) {
    assert.equal(html.includes(marker), true, `${marker} missing`);
  }
});

test("full demo release evidence remains blocked", () => {
  assert.equal(evidence.productionReady, false);
  assert.equal(evidence.phkdVerdict, "BLOCKED");
  assert.equal(evidence.finalStatus, "GOVERNED_PRODUCTION_NO_GO");
  assert.equal(evidence.includedSurfaces.length, 8);
});
