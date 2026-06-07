import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const next = JSON.parse(readFileSync("data/next-in-line.json", "utf8"));
const batch = JSON.parse(readFileSync("data/next-5-batch.json", "utf8"));

test("next batch contains exactly five completed real-build items", () => {
  assert.equal(batch.schema, "maataa.next-batch.v1");
  assert.equal(batch.mode, "completed-real-builds");
  assert.equal(batch.totals.requested, 5);
  assert.equal(batch.items.length, 5);
  assert.equal(batch.totals.included, 5);

  for (const item of batch.items) {
    assert.equal(item.workStatus, "COMPLETED");
    assert.equal(item.evidenceStatus, "ACHIEVED_BY_PROBE");
    assert.equal(item.completion, "ACHIEVED");
    assert.ok(item.completionProbe);
    assert.ok(item.completedAt);
  }
});

test("next batch is derived from the first five completed real-build entries", () => {
  const expected = next.completedRealBuilds.slice(0, 5);
  assert.equal(expected.length, 5, "expected at least five completed real-build entries");

  assert.deepEqual(
    batch.items.map((item) => ({ rank: item.sourceRank, title: item.title, group: item.group, detail: item.detail, completionProbe: item.completionProbe })),
    expected.map((item) => ({ rank: item.completedOrder, title: item.title, group: item.group, detail: item.detail, completionProbe: item.completionProbe })),
  );
});

test("next batch records source evidence for completed probes", () => {
  assert.equal(batch.source.queuePath, "data/next-in-line.json");
  assert.equal(batch.source.queueGeneratedAt, next.generatedAt);
  assert.match(batch.honesty, /completed real-build/i);
  assert.match(batch.honesty, /evidence-backed/i);
});
