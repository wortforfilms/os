#!/usr/bin/env node
// Derives the ACTIVE workers and agents operating on the milestones, from real
// evidence. Honest scope:
//  - "workers" = the per-group probe modules under scripts/achievements/. Each
//    runs every cycle; we count its probes and how many currently pass.
//  - "agent"   = the scheduled milestones-cycle runner. Its last successful run is
//    read from milestones-cycle-last.json (only written when the guard passes).
// The one-off authoring subagents are NOT shown — they have finished and are not
// active. Nothing here is invented.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const J = (p) => (existsSync(join(root, p)) ? JSON.parse(readFileSync(join(root, p), "utf8")) : null);

const ach = J("release/evidence/honest-achievements.json");
const byModule = new Map();
for (const a of (ach && ach.achievements) || []) {
  const mod = (a.verifiedBy || "").replace("scripts/achievements/", "") || "unknown";
  const w = byModule.get(mod) || { module: mod, probes: 0, passing: 0, resolvers: 0 };
  w.probes += 1;
  if (a.achievement === "ACHIEVED") w.passing += 1;
  if (a.resolves) w.resolvers += 1;
  byModule.set(mod, w);
}
const workers = [...byModule.values()].sort((a, b) => b.passing - a.passing || b.probes - a.probes);

const last = J("release/evidence/milestones-cycle-last.json");
const agents = [
  {
    id: "milestones-cycle",
    kind: "scheduled-runner",
    cadence: "recurring (configured in scheduler)",
    status: last ? "active" : "not-yet-run",
    lastRun: last ? last.ranAt : null,
    lastResult: last
      ? `${last.totals.achieved}/${last.totals.milestones} achieved · +${(last.newlyAchieved || []).length} new · ${(last.regressed || []).length} regressed`
      : "no recorded run",
    // Intermediate pipeline steps from the last run (the cycle's todos + status).
    steps: last && Array.isArray(last.steps) ? last.steps : [
      { label: "verify honest achievements", status: "pending" },
      { label: "generate milestones matrix", status: "pending" },
      { label: "render milestones surface", status: "pending" },
      { label: "derive workers + agents", status: "pending" },
      { label: "render kanban", status: "pending" },
      { label: "generate notice board", status: "pending" },
      { label: "honesty guard", status: "pending" },
    ],
  },
];

const payload = {
  schema: "maataa.workers-agents.v1",
  generatedAt: new Date().toISOString(),
  honesty:
    "Workers are probe modules that run every cycle (probes/passing counted from honest-achievements.json). The agent is the scheduled cycle runner (last successful run from milestones-cycle-last.json). One-off authoring subagents are finished and are not listed as active.",
  totals: {
    workers: workers.length,
    totalProbes: workers.reduce((n, w) => n + w.probes, 0),
    totalPassing: workers.reduce((n, w) => n + w.passing, 0),
    agents: agents.length,
  },
  workers,
  agents,
};

writeFileSync(join(root, "release/evidence/workers-agents.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`workers-agents: ${workers.length} workers (${payload.totals.totalPassing}/${payload.totals.totalProbes} probes passing), ${agents.length} agent`);
