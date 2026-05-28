import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("release/KBS_DASHBOARD.html", "utf8");
const evidence = JSON.parse(readFileSync("release/evidence/kbs-dashboard.json", "utf8"));

test("KBS dashboard artifact contains governed status", () => {
  assert.equal(html.includes("KBS Dashboard"), true);
  assert.equal(html.includes("GOVERNED_PRODUCTION_NO_GO"), true);
  assert.equal(html.includes("PRODUCTION_READY = FALSE"), true);
});

test("KBS dashboard includes extracted dashboard sections", () => {
  for (const marker of ["Knowledge Graph Overview", "Claim Status Distribution", "Evidence Strength", "Review Queue", "Domain Overview", "System Health", "Quick Actions"]) {
    assert.equal(html.includes(marker), true, `${marker} missing`);
  }
});

test("KBS dashboard evidence remains blocked", () => {
  assert.equal(evidence.productionReady, false);
  assert.equal(evidence.phkdVerdict, "BLOCKED");
  assert.equal(evidence.finalStatus, "GOVERNED_PRODUCTION_NO_GO");
  assert.equal(evidence.includedSurfaces.length, 8);
});
