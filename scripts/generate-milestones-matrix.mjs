#!/usr/bin/env node
// Generates data/milestones-vs-current.json from the HKD vision boards.
//
// PHKD-honest transformation: every formerly-fabricated metric is reframed as a
// FUTURE MILESTONE (an aspirational target, never presented as achieved) paired
// with its REAL CURRENT STATE, sourced verbatim from the HKD blockedReason /
// claim evidence. No value is invented. Reproducible: same inputs -> same output.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const hkdDir = join(root, "hkd");

const STATUS_MAP = {
  BLOCKED: { achievement: "NOT_ACHIEVED", note: "Target not built; no real data exists yet." },
  PARTIAL: { achievement: "IN_PROGRESS", note: "Partial groundwork exists; target not met." },
  UNVERIFIED: { achievement: "UNVERIFIED", note: "Claimed but not yet evidenced." },
};

// Thematic grouping: clusters the many universes into a handful of milestone
// groups (epics) so the board is navigable. Unmapped universes fall to "Other".
const GROUP_OF = {
  "Platform & Runtime": ["runtime", "observability", "release", "offline", "system", "operations", "hkd-runtime", "lipi", "transport"],
  "Governance & Evidence": ["governance", "evidence", "traceability", "scientific-evidence", "status-matrix-reality-matrix", "meta", "dharma"],
  "Apps & Experience": ["pwa", "dashboard", "hero", "landing", "marketing", "product", "user-journeys", "feature", "service", "workflow"],
  "Knowledge & Intelligence": ["knowledge-graph", "ai-model", "agent", "research", "consciousness", "simulation", "education"],
  "Economy & Identity": ["brahmini-chain", "marketplace", "financial", "identity", "sku", "asset-library"],
  "Civilization & Domains": ["civilization", "ecosystem", "health", "mission", "spatial", "time-evolution", "legacy", "data-schemas", "expanded-maataa-universe-collection"],
};
const UNIVERSE_TO_GROUP = Object.fromEntries(
  Object.entries(GROUP_OF).flatMap(([group, unis]) => unis.map((u) => [u, group])),
);
const groupOf = (universe) => UNIVERSE_TO_GROUP[universe] || "Other";

// Load verified achievements up front so resolution probes can upgrade the
// HKD PARTIAL/UNVERIFIED claims they finish (no double-count).
const achievementsPath = join(root, "release/evidence/honest-achievements.json");
const achievements = existsSync(achievementsPath)
  ? JSON.parse(readFileSync(achievementsPath, "utf8")).achievements || []
  : [];
const resolvedMap = new Map();
for (const a of achievements) {
  if (a.achievement !== "ACHIEVED" || !a.resolves) continue;
  for (const cid of Array.isArray(a.resolves) ? a.resolves : [a.resolves]) resolvedMap.set(cid, a);
}

const files = readdirSync(hkdDir)
  .filter((f) => f.endsWith(".hkd") && !f.startsWith("._"))
  .sort();

const milestones = [];
for (const file of files) {
  let data;
  try {
    data = JSON.parse(readFileSync(join(hkdDir, file), "utf8"));
  } catch {
    continue;
  }
  const claims = Array.isArray(data.claims) ? data.claims : [];
  for (const claim of claims) {
    const mapped = STATUS_MAP[claim.status];
    if (!mapped) continue; // only reframe BLOCKED / PARTIAL / UNVERIFIED
    const universe = data.universe || data.id;
    const resolved = claim.id ? resolvedMap.get(claim.id) : null;
    milestones.push({
      id: claim.id || `${data.id}:unknown`,
      group: groupOf(universe),
      universe,
      // Resolved claims trace to the verifier (keeps the honesty-guard invariant
      // that every VERIFIED milestone's sourceBoard is the verifier).
      sourceBoard: resolved ? "verify-honest-achievements.mjs" : file,
      futureMilestone: claim.text || "",
      currentState: resolved
        ? `${resolved.currentState} [resolved by ${resolved.id}; was ${claim.status}]`
        : claim.blockedReason || claim.evidence || mapped.note,
      achievement: resolved ? "ACHIEVED" : mapped.achievement,
      sourceClaimStatus: resolved ? "VERIFIED" : claim.status,
    });
  }
}

// Merge verified honest achievements as standalone milestones (ACHIEVED only
// when a probe passed at run time). Resolution probes (those with `resolves`)
// are skipped here — they upgrade an existing HKD claim above instead, so they
// are never double-counted.
for (const a of achievements) {
  if (a.resolves) continue;
  milestones.push({
    id: a.id,
    group: groupOf(a.universe),
    universe: a.universe,
    sourceBoard: "verify-honest-achievements.mjs",
    futureMilestone: a.futureMilestone,
    currentState: a.currentState,
    achievement: a.achievement,
    sourceClaimStatus: a.sourceClaimStatus,
  });
}

milestones.sort((a, b) => (a.universe + a.id).localeCompare(b.universe + b.id));

const counts = milestones.reduce((acc, m) => {
  acc[m.achievement] = (acc[m.achievement] || 0) + 1;
  return acc;
}, {});

const byGroup = {};
for (const m of milestones) {
  const g = (byGroup[m.group] ||= { group: m.group, total: 0, achieved: 0, inProgress: 0, unverified: 0, notAchieved: 0, universes: new Set() });
  g.total += 1;
  g.universes.add(m.universe);
  if (m.achievement === "ACHIEVED") g.achieved += 1;
  else if (m.achievement === "IN_PROGRESS") g.inProgress += 1;
  else if (m.achievement === "UNVERIFIED") g.unverified += 1;
  else g.notAchieved += 1;
}
const groupsRollup = Object.values(byGroup)
  .map((g) => ({ ...g, universes: g.universes.size }))
  .sort((a, b) => b.achieved - a.achieved || b.total - a.total);

const payload = {
  schema: "maataa.milestones-vs-current.v1",
  generatedAt: new Date().toISOString(),
  source: "hkd/*.hkd (VisualHKD vision boards)",
  honesty:
    "Every entry is a FUTURE MILESTONE (aspirational target). currentState is the real measured/observed state. No achievement is claimed unless evidenced. Targets are never presented as live metrics.",
  totals: {
    groups: groupsRollup.length,
    universes: new Set(milestones.map((m) => m.universe)).size,
    milestones: milestones.length,
    notAchieved: counts.NOT_ACHIEVED || 0,
    inProgress: counts.IN_PROGRESS || 0,
    unverified: counts.UNVERIFIED || 0,
    achieved: counts.ACHIEVED || 0,
  },
  byGroup: groupsRollup,
  milestones,
};

const json = JSON.stringify(payload, null, 2);
// stableHash is deterministic across runs: it hashes only the milestone content
// (which carries no timestamps), unlike contentHash which includes generatedAt.
const stableHash = createHash("sha256").update(JSON.stringify(milestones)).digest("hex");
const finalPayload = {
  ...payload,
  stableHash,
  contentHash: createHash("sha256").update(json).digest("hex"),
};

writeFileSync(join(root, "data/milestones-vs-current.json"), `${JSON.stringify(finalPayload, null, 2)}\n`, "utf8");
console.log(
  `milestones: ${payload.totals.milestones} across ${payload.totals.universes} universes ` +
    `(NOT_ACHIEVED ${payload.totals.notAchieved}, IN_PROGRESS ${payload.totals.inProgress}, UNVERIFIED ${payload.totals.unverified}, ACHIEVED ${payload.totals.achieved})`,
);
