import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const next = JSON.parse(readFileSync("data/next-in-line.json", "utf8"));
const batch = JSON.parse(readFileSync("data/next-5-batch.json", "utf8"));
const queueBatch = JSON.parse(readFileSync("data/next-12-batch.json", "utf8"));

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

test("next 12 queue batch contains the live in-progress queue without claiming progress", () => {
  assert.equal(queueBatch.schema, "maataa.next-batch.v1");
  assert.equal(queueBatch.mode, "next-queue");
  assert.equal(queueBatch.totals.requested, 12);
  assert.equal(queueBatch.items.length, 12);
  assert.equal(queueBatch.totals.included, 12);
  assert.match(queueBatch.honesty, /not achievement evidence/i);

  const expected = next.queue.slice(0, 12);
  assert.deepEqual(
    queueBatch.items.map((item) => ({ rank: item.sourceRank, sourceKind: item.sourceKind, title: item.title, group: item.group })),
    expected.map((item) => ({ rank: item.rank, sourceKind: item.kind, title: item.title, group: item.group })),
  );

  for (const item of queueBatch.items) {
    assert.equal(item.completion, "NOT_STARTED");
    assert.equal(item.completedAt, null);
    assert.ok(["BLOCKED_CANDIDATE_ONLY", "BLOCKED_UNTIL_IMPLEMENTED"].includes(item.workStatus));
    assert.notEqual(item.evidenceStatus, "ACHIEVED_BY_PROBE");
  }
});
