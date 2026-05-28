import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("release/KBS_FULL_DEMO.html", "utf8");
const evidence = JSON.parse(readFileSync("release/evidence/kbs-full-demo.json", "utf8"));

test("KBS full demo artifact contains governed no-go status", () => {
  assert.equal(html.includes("KBS Full Demo"), true);
  assert.equal(html.includes("GOVERNED_PRODUCTION_NO_GO"), true);
  assert.equal(html.includes("PRODUCTION_READY = FALSE"), true);
});

test("KBS full demo includes dashboard, pages, and runtime board", () => {
  for (const marker of [
    "KBS Dashboard",
    "Full Demo - All Pages Overview",
    "All Runtimes Board",
    "55 total runtimes",
    "Knowledge Graph Overview",
    "Review Queue",
    "PHKD Governance"
  ]) {
    assert.equal(html.includes(marker), true, `${marker} missing`);
  }
});

test("KBS full demo preserves extracted page count", () => {
  const pageMarkers = html.match(/<span class="num">[0-9]{2}<\/span><strong>/g) ?? [];
  assert.equal(pageMarkers.length, 17);
});

test("KBS full demo evidence remains blocked", () => {
  assert.equal(evidence.productionReady, false);
  assert.equal(evidence.phkdVerdict, "BLOCKED");
  assert.equal(evidence.finalStatus, "GOVERNED_PRODUCTION_NO_GO");
  assert.equal(evidence.includedSurfaces.length, 10);
  assert.ok(evidence.activeBlockers.includes("hardware_attestation_missing"));
});
