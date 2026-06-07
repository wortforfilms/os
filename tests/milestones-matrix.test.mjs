import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const matrix = JSON.parse(readFileSync("data/milestones-vs-current.json", "utf8"));

test("no milestone is ACHIEVED without VERIFIED provenance", () => {
  const unbacked = matrix.milestones.filter(
    (m) => m.achievement === "ACHIEVED" && m.sourceClaimStatus !== "VERIFIED",
  );
  assert.equal(unbacked.length, 0, `unbacked ACHIEVED milestones: ${unbacked.map((m) => m.id).join(", ")}`);
});

test("achieved total equals count of ACHIEVED milestones", () => {
  const counted = matrix.milestones.filter((m) => m.achievement === "ACHIEVED").length;
  assert.equal(matrix.totals.achieved, counted);
});

test("every milestone carries a recognised status (no unlabeled metric)", () => {
  const ok = new Set(["ACHIEVED", "NOT_ACHIEVED", "IN_PROGRESS", "UNVERIFIED"]);
  const bad = matrix.milestones.filter((m) => !ok.has(m.achievement));
  assert.equal(bad.length, 0, `unlabeled milestones: ${bad.map((m) => m.id).join(", ")}`);
});

test("verified achievements trace back to the executable verifier", () => {
  const verified = matrix.milestones.filter((m) => m.sourceClaimStatus === "VERIFIED");
  assert.ok(verified.length > 0, "expected at least one verified achievement");
  for (const m of verified) {
    assert.equal(m.sourceBoard, "verify-honest-achievements.mjs");
  }
});
