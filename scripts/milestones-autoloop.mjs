#!/usr/bin/env node
// Self-driving milestones AUTO-LOOP (build/fix → verify, with backoff).
//
// Drives candidate milestones toward ACHIEVED using ONLY human-reviewed
// remediations (scripts/milestones-remediations/index.mjs). It never fabricates:
// a milestone advances only when the real honest cycle re-verifies it as
// ACHIEVED. Anything else is rolled back and recorded as failed. FAIL CLOSED.
//
// Backoff ladder (as requested): 13 → 5 → 1.
//   • A batch that verifies cleanly ("ideal") is kept, then the loop resets to
//     the next batch of 13.
//   • A batch that fails verification is rolled back and retried at the smaller
//     size (13→5, 5→1) to shrink blast radius and isolate the culprit.
//   • A single milestone (size 1) that still fails is rolled back, recorded as
//     FAILED_VERIFY, skipped, and the ladder resets to 13 for the remainder.
//
// Candidate pool (per request): UNVERIFIED first, then IN_PROGRESS.
// Only candidates that have a registered remediation are actionable; the rest
// are recorded once as SKIPPED_NO_REMEDIATION (you cannot build/fix what has no
// reviewed remediation — fail closed).
//
// The core (runAutoloop) is dependency-injected so the backoff/rollback logic
// can be unit-tested with a fast mock verifier (see milestones-autoloop.test.mjs).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const LADDER = [13, 5, 1];

// ── File snapshot / rollback (rollbackability is mandatory) ──────────────────
// Some user mounts deny unlink (delete) entirely as a safety policy. Rollback
// therefore never depends on deletion: modified files are restored byte-for-byte
// (write is allowed); files that did not exist before are unlink-attempted, and
// if that is blocked they are truncated to empty and reported as orphans so a
// human can remove them. Returns the list of orphan paths.
export const snapshotFiles = (root, paths, fs = { existsSync, readFileSync }) =>
  paths.map((rel) => {
    const abs = join(root, rel);
    return fs.existsSync(abs) ? { rel, existed: true, content: fs.readFileSync(abs) } : { rel, existed: false };
  });

export const restoreFiles = (root, snap, fs = { existsSync, writeFileSync, mkdirSync, rmSync }) => {
  const orphans = [];
  for (const s of snap) {
    const abs = join(root, s.rel);
    if (s.existed) {
      fs.mkdirSync(dirname(abs), { recursive: true });
      fs.writeFileSync(abs, s.content);
    } else if (fs.existsSync(abs)) {
      try {
        fs.rmSync(abs, { force: true });
      } catch {
        try { fs.writeFileSync(abs, ""); } catch { /* best effort */ }
        orphans.push(s.rel);
      }
    }
  }
  return orphans;
};

// ── Injectable backoff core ──────────────────────────────────────────────────
// deps: { actionable, skipped, remediations, applyFix(m), verifyChunk(chunk) ->
//         { advancedIds: string[], cycleOk: bool, tail? }, snapshot(paths),
//         restore(snap) -> orphans[], ladder, log }
// Returns { results, batches, advanced, orphanPaths }.
export async function runAutoloop(deps) {
  const { actionable, skipped, remediations, applyFix, verifyChunk, snapshot, restore, ladder = LADDER, log = () => {} } = deps;
  const results = skipped.map((m) => ({ id: m.id, group: m.group, was: m.achievement, status: "SKIPPED_NO_REMEDIATION" }));
  const batches = [];
  const orphanPaths = new Set();
  let queue = [...actionable];
  let ladderIdx = 0;
  let advanced = 0;
  const maxIters = actionable.length * ladder.length + 5; // safety bound
  let iters = 0;

  while (queue.length && iters++ < maxIters) {
    const size = ladder[ladderIdx];
    const chunk = queue.slice(0, size);
    const touches = [...new Set(chunk.flatMap((m) => remediations[m.id].touches || []))];
    const snap = snapshot(touches);

    const applied = [];
    for (const m of chunk) {
      try {
        const res = await applyFix(m);
        applied.push({ id: m.id, changed: !!(res && res.changed) });
      } catch (err) {
        applied.push({ id: m.id, changed: false, error: err.message });
      }
    }

    const { advancedIds, cycleOk, tail } = await verifyChunk(chunk);
    const advancedSet = new Set(advancedIds);
    const ideal = cycleOk && chunk.every((m) => advancedSet.has(m.id)) && applied.every((a) => !a.error);

    batches.push({ size, ids: chunk.map((m) => m.id), cycleOk, advanced: [...advancedIds], ideal, tail });

    if (ideal) {
      for (const m of chunk) {
        results.push({ id: m.id, group: m.group, was: m.achievement, status: "ADVANCED" });
        advanced += 1;
      }
      queue = queue.slice(size);
      ladderIdx = 0; // ideal → reset ladder to the largest batch for the next run
      log(`✓ batch/${size} ideal — advanced ${chunk.length}; ${queue.length} remaining`);
    } else {
      for (const o of restore(snap)) orphanPaths.add(o); // FAIL CLOSED
      if (size > 1) {
        ladderIdx += 1; // shrink 13→5→1 and retry the same region smaller
        log(`✗ batch/${size} failed — rolled back, shrinking to ${ladder[ladderIdx]}`);
      } else {
        const m = chunk[0];
        results.push({ id: m.id, group: m.group, was: m.achievement, status: "FAILED_VERIFY" });
        queue = queue.slice(1); // isolated failure → skip it, reset ladder
        ladderIdx = 0;
        log(`✗ milestone ${m.id} failed at size 1 — rolled back, skipped`);
      }
    }
  }
  return { results, batches, advanced, orphanPaths: [...orphanPaths] };
}

// ── CLI: wire the real honest cycle + matrix into the core ───────────────────
async function main() {
  const root = process.cwd();
  const J = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
  const MATRIX = "data/milestones-vs-current.json";
  const OUT = "release/evidence/milestones-autoloop-last.json";
  const log = (...a) => console.log(...a);

  let remediations = {};
  try {
    const mod = await import(pathToFileURL(join(root, "scripts/milestones-remediations/index.mjs")).href);
    remediations = mod.remediations || mod.default || {};
  } catch (err) {
    log(`! no remediation registry loaded (${err.message}); treating all candidates as SKIPPED`);
  }

  const readMatrix = () => J(MATRIX);
  const rank = { UNVERIFIED: 0, IN_PROGRESS: 1 };
  const candidates = readMatrix()
    .milestones.filter((m) => m.achievement === "UNVERIFIED" || m.achievement === "IN_PROGRESS")
    .sort((a, b) => (rank[a.achievement] - rank[b.achievement]) || a.id.localeCompare(b.id));
  const actionable = candidates.filter((m) => remediations[m.id]);
  const skipped = candidates.filter((m) => !remediations[m.id]);

  log(`candidates: ${candidates.length} (UNVERIFIED ${candidates.filter((m) => m.achievement === "UNVERIFIED").length}, IN_PROGRESS ${candidates.filter((m) => m.achievement === "IN_PROGRESS").length})`);
  log(`actionable (have reviewed remediation): ${actionable.length} · skipped (no remediation): ${skipped.length}`);

  const ctx = { root, join, fs: { existsSync, readFileSync, writeFileSync, mkdirSync }, execFileSync };
  const runCycle = () => {
    try {
      execFileSync("node", ["scripts/milestones-cycle.mjs"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
      return { ok: true };
    } catch (err) {
      return { ok: false, tail: (err.stdout || err.stderr || err.message).toString().slice(-400) };
    }
  };
  const achievementOf = (id) => (readMatrix().milestones.find((m) => m.id === id) || {}).achievement;

  const { results, batches, advanced, orphanPaths } = await runAutoloop({
    actionable, skipped, remediations, ladder: LADDER, log,
    applyFix: (m) => remediations[m.id].fix(ctx),
    snapshot: (paths) => snapshotFiles(root, paths),
    restore: (snap) => restoreFiles(root, snap),
    verifyChunk: (chunk) => {
      const cycle = runCycle();
      if (!cycle.ok) {
        runCycle(); // regenerate evidence after a failed cycle
        return { advancedIds: [], cycleOk: false, tail: cycle.tail };
      }
      const advancedIds = chunk.filter((m) => achievementOf(m.id) === "ACHIEVED").map((m) => m.id);
      return { advancedIds, cycleOk: true };
    },
  });

  const finalCycle = runCycle();
  const finalMatrix = readMatrix();
  const payload = {
    schema: "maataa.milestones-autoloop.v1",
    ranAt: new Date().toISOString(),
    honesty:
      "Milestones advance ONLY when the real honest cycle re-verifies them as ACHIEVED via human-reviewed remediations. No probes added, no stubs, nothing fabricated. Non-advancing changes are rolled back. Fail closed.",
    ladder: LADDER,
    pool: { candidates: candidates.length, actionable: actionable.length, skipped: skipped.length },
    advanced,
    rollbackDegraded: orphanPaths.length > 0,
    orphanPaths,
    finalGuardOk: finalCycle.ok,
    totals: finalMatrix.totals,
    stableHash: finalMatrix.stableHash,
    batches,
    results,
  };
  mkdirSync(join(root, "release/evidence"), { recursive: true });
  writeFileSync(join(root, OUT), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  log("\n── milestones auto-loop complete ──");
  log(`candidates ${candidates.length} · actionable ${actionable.length} · ADVANCED ${advanced} · SKIPPED_NO_REMEDIATION ${skipped.length}`);
  if (orphanPaths.length) log(`! rollback degraded — orphan files left for human cleanup: ${orphanPaths.join(", ")}`);
  log(`final honesty guard: ${finalCycle.ok ? "PASS" : "FAIL"} · ACHIEVED ${finalMatrix.totals.achieved}/${finalMatrix.totals.milestones}`);
  log(`evidence → ${OUT}`);
  if (!finalCycle.ok) {
    console.error("FAIL CLOSED: final honesty guard failed — success NOT recorded.");
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
