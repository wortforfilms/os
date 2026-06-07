#!/usr/bin/env node
// Generates data/next-in-line.json — the honest "what's next" queue.
//
// Two honest sources:
//  1. A curated backlog of REAL next builds (type "real-build"). These are
//     genuine engineering targets, NOT fabricated milestones — each needs actual
//     code + a passing test before it can flip, like the runtimes already built.
//  2. The current IN_PROGRESS claims from the matrix (type "in-progress-claim"),
//     surfaced as lower-confidence candidates (most are aspirational board claims).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const matrix = existsSync(join(root, "data/milestones-vs-current.json"))
  ? JSON.parse(readFileSync(join(root, "data/milestones-vs-current.json"), "utf8"))
  : { milestones: [], totals: {} };
const achievements = existsSync(join(root, "release/evidence/honest-achievements.json"))
  ? JSON.parse(readFileSync(join(root, "release/evidence/honest-achievements.json"), "utf8")).achievements || []
  : [];
const achievedProbeIds = new Set(achievements.filter((a) => a.achievement === "ACHIEVED").map((a) => a.id));

// Curated real-build backlog (ordered). Updated as work lands.
const REAL_BUILDS = [
  { title: "Wire runtime-mission propose → runtime-governance enforce", detail: "runtime-governance now exists (enforce/audit/rollback). Connect mission's proposals to real enforcement decisions + test.", group: "Governance & Evidence", completionProbe: "a-gov-runtime-mission-governance-wired" },
  { title: "Persistence tier for the 6 runtimes", detail: "Back KG/mission/registry/validation/observability/governance with SQLite (node:sqlite) so state survives restarts; add persistence tests.", group: "Platform & Runtime", completionProbe: "a-platform-runtime-persistence-tier-operational" },
  { title: "Wire runtime-observability.collect into the gate", detail: "Have the governed-production-gate read live runtime health via observability.collect for a real topology snapshot.", group: "Platform & Runtime", completionProbe: "a-gov-gate-observability-live-health" },
  { title: "runtime-transport facade", detail: "A real deterministic transport contract between runtimes (currently no transport universe runtime).", group: "Platform & Runtime", completionProbe: "a-platform-runtime-transport-facade-operational" },
  { title: "lipi-agent wrapper", detail: "Honest agent wrapper over lipi-runtime (transliteration/lineage) — flips a-knowledge-lipi-agent-wrapper.", group: "Knowledge & Intelligence", completionProbe: "a-knowledge-lipi-agent-wrapper" },
];
const completedRealBuilds = REAL_BUILDS.filter((b) => achievedProbeIds.has(b.completionProbe));
const activeRealBuilds = REAL_BUILDS.filter((b) => !achievedProbeIds.has(b.completionProbe));

const inProgress = (matrix.milestones || [])
  .filter((m) => m.achievement === "IN_PROGRESS")
  .slice(0, 12)
  .map((m) => ({ id: m.id, title: m.futureMilestone, group: m.group, detail: m.currentState }));

const queue = [
  ...activeRealBuilds.map((b, i) => ({ rank: i + 1, kind: "real-build", ...b })),
  ...inProgress.map((m, i) => ({ rank: activeRealBuilds.length + i + 1, kind: "in-progress-claim", ...m })),
];

const payload = {
  schema: "maataa.next-in-line.v1",
  generatedAt: new Date().toISOString(),
  honesty:
    "real-build items are genuine engineering targets that require code + a passing test before they flip (no fabrication). in-progress-claim items are surfaced from the matrix and are mostly aspirational board claims.",
  totals: {
    realBuilds: activeRealBuilds.length,
    completedRealBuilds: completedRealBuilds.length,
    inProgressShown: inProgress.length,
    achieved: matrix.totals?.achieved ?? 0,
    milestones: matrix.totals?.milestones ?? 0,
  },
  completedRealBuilds: completedRealBuilds.map((b, i) => ({ completedOrder: i + 1, kind: "completed-real-build", ...b })),
  queue,
};

writeFileSync(join(root, "data/next-in-line.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`next-in-line: ${activeRealBuilds.length} real-build + ${inProgress.length} in-progress candidates (${completedRealBuilds.length} completed real-builds)`);
