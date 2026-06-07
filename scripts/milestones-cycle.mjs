#!/usr/bin/env node
// Self-driving milestones cycle.
//
// Runs the full honest chain in order:
//   verify-honest-achievements → generate-milestones-matrix
//   → render-milestones-surface → generate-notice-board → honesty guard
//
// Any probe that newly passes is promoted to ACHIEVED automatically (the cycle
// re-evaluates real evidence — it never fabricates a milestone). On completion it
// reports the delta vs the previous run so "next milestones" are picked up by
// itself. FAIL CLOSED: if the honesty guard fails, the cycle exits non-zero and
// does NOT record success.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const J = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const lastPath = "release/evidence/milestones-cycle-last.json";

const steps = [];
const run = (label, args) => {
  process.stdout.write(`• ${label} … `);
  const t0 = Date.now();
  try {
    execFileSync("node", args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    const ms = Date.now() - t0;
    steps.push({ label, status: "ok", ms });
    console.log(`ok (${ms}ms)`);
  } catch (err) {
    steps.push({ label, status: "failed", ms: Date.now() - t0 });
    console.log("FAILED");
    throw new Error(`${label} failed: ${(err.stdout || err.stderr || err.message).toString().slice(0, 300)}`);
  }
};

// 1) Re-evaluate evidence and rebuild every surface.
// Build the parallel test-cache first so the verifier serves test probes from it
// (one fast concurrent run) instead of spawning ~50 serial processes.
run("build test cache", ["scripts/build-test-cache.mjs"]);
run("verify honest achievements", ["scripts/verify-honest-achievements.mjs"]);
run("generate milestones matrix", ["scripts/generate-milestones-matrix.mjs"]);
run("render milestones surface", ["scripts/render-milestones-surface.mjs"]);
run("derive workers + agents", ["scripts/generate-workers-agents.mjs"]);
run("derive next-in-line", ["scripts/generate-next-in-line.mjs"]);
run("render kanban", ["scripts/render-kanban.mjs"]);
run("generate notice board", ["scripts/generate-notice-board.mjs"]);

// 2) Honesty guard — fail closed.
process.stdout.write("• honesty guard … ");
let guardOut;
try {
  guardOut = execFileSync("node", ["--test", "tests/milestones-matrix.test.mjs"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch (err) {
  guardOut = `${err.stdout || ""}${err.stderr || ""}`;
}
const guardPass = (guardOut.match(/# pass (\d+)/) || [])[1];
const guardFail = (guardOut.match(/# fail (\d+)/) || [])[1];
if (guardFail !== "0" || !(Number(guardPass) > 0)) {
  steps.push({ label: "honesty guard", status: "failed", ms: 0 });
  console.log("FAILED");
  console.error(`Honesty guard failed (pass=${guardPass}, fail=${guardFail}). Cycle aborted — success NOT recorded.`);
  process.exit(1);
}
steps.push({ label: "honesty guard", status: "ok", ms: 0, detail: `${guardPass}/${guardPass}` });
console.log(`ok (${guardPass}/${guardPass})`);

// 3) Compute delta vs last recorded run.
const matrix = J("data/milestones-vs-current.json");
const achievedIds = matrix.milestones.filter((m) => m.achievement === "ACHIEVED").map((m) => m.id).sort();
const inProgressIds = matrix.milestones.filter((m) => m.achievement === "IN_PROGRESS").map((m) => m.id);

const prev = existsSync(join(root, lastPath)) ? J(lastPath) : { achievedIds: [], totals: {} };
const prevSet = new Set(prev.achievedIds || []);
const newlyAchieved = achievedIds.filter((id) => !prevSet.has(id));
const regressed = (prev.achievedIds || []).filter((id) => !achievedIds.includes(id));

const summary = {
  schema: "maataa.milestones-cycle.v1",
  ranAt: new Date().toISOString(),
  totals: matrix.totals,
  achievedIds,
  newlyAchieved,
  regressed,
  stableHash: matrix.stableHash,
  steps,
};
writeFileSync(join(root, lastPath), `${JSON.stringify(summary, null, 2)}\n`, "utf8");

// 4) Report.
console.log("\n── milestones cycle complete ──");
console.log(`ACHIEVED ${matrix.totals.achieved}/${matrix.totals.milestones} · IN_PROGRESS ${inProgressIds.length} · groups ${matrix.totals.groups}`);
if (newlyAchieved.length) console.log(`+ newly achieved (${newlyAchieved.length}): ${newlyAchieved.join(", ")}`);
if (regressed.length) console.log(`! regressed to not-achieved (${regressed.length}): ${regressed.join(", ")}`);
if (!newlyAchieved.length && !regressed.length) console.log("no change since last run (evidence stable).");
