// Fast unit tests for the auto-loop backoff core (no real cycle; mock verifier).
// Proves: ideal→advance+reset, fail→shrink 13→5→1, size-1 fail→FAILED_VERIFY,
// rollback invoked on every failure, and skipped items recorded once.
import assert from "node:assert/strict";
import { test } from "node:test";
import { runAutoloop, restoreFiles, LADDER } from "../scripts/milestones-autoloop.mjs";

const mk = (n, ach = "UNVERIFIED") => Array.from({ length: n }, (_, i) => ({ id: `m${i + 1}`, group: "G", achievement: ach }));
const reg = (ms) => Object.fromEntries(ms.map((m) => [m.id, { touches: [`t/${m.id}`], fix: async () => ({ changed: true }) }]));

test("ladder is 13 → 5 → 1", () => assert.deepEqual(LADDER, [13, 5, 1]));

test("all-ideal: advances everything in batches of 13, never shrinks", async () => {
  const actionable = mk(20);
  let restores = 0;
  const r = await runAutoloop({
    actionable, skipped: [], remediations: reg(actionable),
    applyFix: async () => ({ changed: true }),
    verifyChunk: async (chunk) => ({ advancedIds: chunk.map((m) => m.id), cycleOk: true }),
    snapshot: () => [], restore: () => { restores++; return []; },
  });
  assert.equal(r.advanced, 20);
  assert.equal(restores, 0);
  assert.deepEqual(r.batches.map((b) => b.size), [13, 13]); // 13 then remaining 7 at size 13
  assert.ok(r.results.every((x) => x.status === "ADVANCED"));
});

test("one poison pill: shrinks 13→5→1, isolates it as FAILED_VERIFY, rest advance", async () => {
  const actionable = mk(13);
  const poison = "m1"; // first item never verifies
  let restores = 0;
  const r = await runAutoloop({
    actionable, skipped: [], remediations: reg(actionable),
    applyFix: async () => ({ changed: true }),
    verifyChunk: async (chunk) => {
      const hasPoison = chunk.some((m) => m.id === poison);
      if (hasPoison) return { advancedIds: chunk.filter((m) => m.id !== poison).map((m) => m.id), cycleOk: true };
      return { advancedIds: chunk.map((m) => m.id), cycleOk: true };
    },
    snapshot: () => [], restore: () => { restores++; return []; },
  });
  // batch sizes observed: 13(fail)→5(fail)→1(fail on m1, isolated)→ then 12 remaining at 13
  assert.deepEqual(r.batches.map((b) => b.size), [13, 5, 1, 13]);
  assert.equal(r.results.find((x) => x.id === poison).status, "FAILED_VERIFY");
  assert.equal(r.advanced, 12);
  assert.equal(restores, 3); // rolled back on each of the 3 failures
});

test("cycle failure (guard red) is treated as non-ideal and rolled back", async () => {
  const actionable = mk(1);
  let restores = 0;
  const r = await runAutoloop({
    actionable, skipped: [], remediations: reg(actionable),
    applyFix: async () => ({ changed: true }),
    verifyChunk: async () => ({ advancedIds: [], cycleOk: false, tail: "guard failed" }),
    snapshot: () => [], restore: () => { restores++; return []; },
  });
  assert.equal(r.advanced, 0);
  assert.equal(restores, 3); // a single failing item still walks 13→5→1 before isolation
  assert.equal(r.results[0].status, "FAILED_VERIFY");
  assert.deepEqual(r.batches.map((b) => b.size), [13, 5, 1]);
});

test("skipped items (no remediation) are recorded once, never advanced", async () => {
  const skipped = mk(3);
  const r = await runAutoloop({
    actionable: [], skipped, remediations: {},
    applyFix: async () => ({ changed: true }),
    verifyChunk: async () => ({ advancedIds: [], cycleOk: true }),
    snapshot: () => [], restore: () => [],
  });
  assert.equal(r.advanced, 0);
  assert.equal(r.results.length, 3);
  assert.ok(r.results.every((x) => x.status === "SKIPPED_NO_REMEDIATION"));
});

test("restoreFiles is unlink-tolerant: blocked delete → truncate + orphan report", () => {
  const writes = [];
  const fakeFs = {
    existsSync: () => true,
    writeFileSync: (p, c) => writes.push([p, c]),
    mkdirSync: () => {},
    rmSync: () => { throw Object.assign(new Error("EPERM"), { code: "EPERM" }); },
  };
  const orphans = restoreFiles("/root", [{ rel: "new.tmp", existed: false }], fakeFs);
  assert.deepEqual(orphans, ["new.tmp"]); // reported for human cleanup
  assert.ok(writes.some(([, c]) => c === "")); // truncated to empty
});

test("restoreFiles restores modified files byte-for-byte", () => {
  const writes = [];
  const fakeFs = {
    existsSync: () => true,
    writeFileSync: (p, c) => writes.push([p, c]),
    mkdirSync: () => {},
    rmSync: () => {},
  };
  const orphans = restoreFiles("/root", [{ rel: "f.txt", existed: true, content: "ORIG" }], fakeFs);
  assert.deepEqual(orphans, []);
  assert.equal(writes[0][1], "ORIG");
});
