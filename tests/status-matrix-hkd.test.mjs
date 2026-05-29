import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const hkd = JSON.parse(readFileSync("hkd/status-matrix-universe.hkd", "utf8"));

test("status matrix HKD preserves the supplied source image", () => {
  assert.equal(
    hkd.sourceImage,
    "/Users/vesahe/Downloads/Maataa_OS_Universe_Collection_Batch3/018_Status_Matrix_Reality_Matrix_Universe.png"
  );
  assert.equal(hkd.status, "vision");
  assert.equal(hkd.universe, "status-matrix-reality-matrix");
});

test("status matrix HKD captures all visible category rows and status levels", () => {
  assert.equal(hkd.extractedData.statusLevels.length, 10);
  assert.equal(hkd.extractedData.matrixRows.length, 15);
  assert.deepEqual(hkd.extractedData.matrixColumns, ["I", "D", "S", "SC", "IM", "T", "V", "DP", "OB", "GV", "TOTAL"]);
});

test("status matrix totals are internally represented", () => {
  const rowTotal = hkd.extractedData.matrixRows.reduce((sum, row) => sum + row.total, 0);
  const columnTotal = hkd.extractedData.matrixTotals.values.reduce((sum, value) => sum + value, 0);
  assert.equal(rowTotal, 8022);
  assert.equal(columnTotal, 8153);
  assert.equal(hkd.extractedData.matrixTotals.total, 8153);
  assert.notEqual(rowTotal, hkd.extractedData.matrixTotals.total);
});

test("status matrix contradictions are explicit blockers", () => {
  assert.ok(hkd.extractedData.internalContradictions.some((item) => item.includes("4,842")));
  assert.ok(hkd.extractedData.internalContradictions.some((item) => item.includes("8,022")));
  assert.ok(hkd.claims.some((claim) => claim.id === "claim-matrix-total-8153" && claim.status === "BLOCKED"));
  assert.ok(hkd.claims.some((claim) => claim.id === "claim-row-total-contradiction" && claim.status === "BLOCKED"));
  assert.ok(hkd.claims.some((claim) => claim.id === "claim-dashboard-row-contradiction" && claim.status === "BLOCKED"));
  assert.ok(hkd.claims.some((claim) => claim.id === "claim-api-row-contradiction" && claim.status === "BLOCKED"));
  assert.ok(hkd.claims.some((claim) => claim.id === "claim-feature-total-contradiction" && claim.status === "BLOCKED"));
  assert.ok(hkd.claims.some((claim) => claim.id === "claim-dataset-total-contradiction" && claim.status === "BLOCKED"));
  assert.ok(hkd.claims.some((claim) => claim.id === "claim-document-total-contradiction" && claim.status === "BLOCKED"));
});

test("status matrix quick actions are captured without claiming implementation", () => {
  assert.deepEqual(hkd.extractedData.quickActions, [
    "View by Category",
    "View by Status",
    "Export Matrix",
    "Download Report",
    "Update Status",
    "Add Item"
  ]);
  const quickActionClaim = hkd.claims.find((claim) => claim.id === "claim-quick-actions-functional");
  assert.equal(quickActionClaim?.status, "UNVERIFIED");
});

test("status matrix HKD uses only PHKD claim states", () => {
  const allowed = new Set(["BLOCKED", "PARTIAL", "UNVERIFIED"]);
  for (const claim of hkd.claims) assert.equal(allowed.has(claim.status), true, claim.id);
});
