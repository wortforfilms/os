import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("426 master timeline is generated from the runtime master", () => {
  assert.equal(existsSync("release/evidence/lipi-426-master-timeline.json"), true);
  assert.equal(existsSync("release/LIPI_426_MASTER_TIMELINE.html"), true);

  const timeline = JSON.parse(readFileSync("release/evidence/lipi-426-master-timeline.json", "utf8"));
  assert.equal(timeline.totals.expected, 426);
  assert.equal(timeline.totals.total, 426);
  assert.equal(timeline.entries.length, 426);
  assert.equal(timeline.reviewState, "CONTROLLED_NO_GO");
  assert.equal(timeline.governedProductionGo, false);
});

test("426 master timeline keeps reserved evidence slots blocked and visible", () => {
  const timeline = JSON.parse(readFileSync("release/evidence/lipi-426-master-timeline.json", "utf8"));

  assert.equal(timeline.totals.reservedEvidenceSlots, 381);
  assert.equal(timeline.totals.blockedTotal, 382);
  assert.equal(timeline.entries.filter((e) => e.reserved).length, 381);
  assert.ok(timeline.entries.find((e) => e.id === "indus" && e.status === "BLOCKED"));
});

test("426 master timeline contains canonical and Kharosthi candidate rows without collision", () => {
  const timeline = JSON.parse(readFileSync("release/evidence/lipi-426-master-timeline.json", "utf8"));
  const canonical = timeline.entries.find((e) => e.id === "kharosthi");
  const candidate = timeline.entries.find((e) => e.id === "endangered-kharosthi");

  assert.ok(canonical);
  assert.equal(canonical.status, "HISTORICAL");
  assert.ok(candidate);
  assert.equal(candidate.status, "ENDANGERED");
  assert.equal(candidate.vitality, "EXTINCT");
});

test("426 master timeline surface avoids production and certification claims", () => {
  const html = readFileSync("release/LIPI_426_MASTER_TIMELINE.html", "utf8");

  assert.match(html, /reserved evidence slots/);
  assert.match(html, /no certification or revival claim/i);
  assert.doesNotMatch(html, /ACHIEVED|productionReady:true|governedProductionGo:true/i);
});
