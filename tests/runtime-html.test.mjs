import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const inventory = JSON.parse(readFileSync("data/html-prototype-inventory.json", "utf8"));
const themeLab = JSON.parse(readFileSync("data/theme-lab-runtime.json", "utf8"));
const manifest = JSON.parse(readFileSync("release/runtime-html/manifest.json", "utf8"));

test("runtime HTML manifest includes index plus every absorbed prototype", () => {
  assert.equal(manifest.pages.length, inventory.prototypes.length + 3);
  assert.equal(existsSync("release/runtime-html/index.html"), true);
  assert.equal(existsSync("release/runtime-html/theme_lab.html"), true);
  assert.equal(existsSync("release/runtime-html/services_and_features.html"), true);
  for (const prototype of inventory.prototypes) {
    assert.equal(existsSync(`release/runtime-html/${prototype.id}.html`), true);
  }
});

test("runtime HTML pages expose all contract categories", () => {
  for (const prototype of inventory.prototypes) {
    const html = readFileSync(`release/runtime-html/${prototype.id}.html`, "utf8");
    for (const required of ["Frames", "Types", "Schemas", "Data Frames", "Runtimes", "Workflows", "UI", "Widgets"]) {
      assert.equal(html.includes(required), true, `${prototype.id} missing ${required}`);
    }
  }
});

test("runtime HTML remains governed preview output", () => {
  assert.equal(manifest.productionReady, false);
  assert.equal(manifest.finalStatus, "GOVERNED_PRODUCTION_NO_GO");
  assert.equal(manifest.rawHtmlCopied, false);
  assert.equal(manifest.noFakeClaims, true);
});

test("services and features focus page includes both product surfaces", () => {
  const html = readFileSync("release/runtime-html/services_and_features.html", "utf8");
  assert.equal(html.includes("Maataa OS Services"), true);
  assert.equal(html.includes("Maataa OS Features"), true);
  assert.equal(html.includes("PRODUCTION_READY=false"), true);
});

test("ThemeLab runtime page preserves extracted runtime matrix", () => {
  const html = readFileSync("release/runtime-html/theme_lab.html", "utf8");
  assert.equal(themeLab.themeFamilies[0].count, 67);
  assert.equal(themeLab.runtimeFamilies.length, 11);
  assert.equal(themeLab.governance.productionReady, false);
  assert.equal(html.includes("ThemeLab"), true);
  assert.equal(html.includes("Quick Stack Builder"), true);
  assert.equal(html.includes("CSS Variables"), true);
  assert.equal(html.includes("Full Adaptive Consciousness Runtime"), true);
  assert.equal(html.includes("FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO"), true);
});
