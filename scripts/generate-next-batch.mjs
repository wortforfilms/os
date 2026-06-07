#!/usr/bin/env node
// Creates the next implementation batch from the honest next-in-line queue.
//
// This is a planning artifact, not progress evidence. Every item remains blocked
// until real code and a passing verifier flip the underlying milestone.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
const completedMode = args.includes("--completed");
const batchSize = Number(args.find((arg) => /^\d+$/.test(arg)) || 5);

const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const next = readJson("data/next-in-line.json");
const cycle = readJson("release/evidence/milestones-cycle-last.json");

if (!Number.isInteger(batchSize) || batchSize < 1) {
  throw new Error(`batch size must be a positive integer, got ${process.argv[2] || "5"}`);
}

if (!Array.isArray(next.queue)) {
  throw new Error("data/next-in-line.json is missing queue[]");
}

const sourcePool = completedMode ? (next.completedRealBuilds || []) : next.queue.filter((item) => item.kind === "real-build");
const selected = sourcePool.slice(0, batchSize);
if (selected.length < batchSize) {
  const label = completedMode ? "completed real-build" : "real-build";
  throw new Error(`cannot create next-${batchSize} batch: only ${selected.length} ${label} items are available`);
}

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);

const hash = createHash("sha256").update(JSON.stringify(selected)).digest("hex").slice(0, 12);
const sourceDate = String(next.generatedAt || cycle.ranAt || new Date().toISOString()).slice(0, 10).replace(/-/g, "");

const items = selected.map((item, index) => ({
  batchOrder: index + 1,
  sourceRank: item.rank ?? item.completedOrder,
  id: `next-${index + 1}-${slugify(item.title)}`,
  title: item.title,
  group: item.group,
  detail: item.detail,
  completionProbe: item.completionProbe ?? null,
  workStatus: completedMode ? "COMPLETED" : "BLOCKED_UNTIL_IMPLEMENTED",
  evidenceStatus: completedMode ? "ACHIEVED_BY_PROBE" : "MISSING_UNTIL_CODE_AND_TEST",
  completion: completedMode ? "ACHIEVED" : "NOT_STARTED",
  completedAt: completedMode ? cycle.ranAt : null,
  requiredToFlip: ["code implementation", "passing focused test", "milestones/evidence regeneration"],
}));

const payload = {
  schema: "maataa.next-batch.v1",
  batchId: `next-${batchSize}-${sourceDate}-${hash}`,
  generatedAt: new Date().toISOString(),
  mode: completedMode ? "completed-real-builds" : "next-real-builds",
  source: {
    queuePath: "data/next-in-line.json",
    queueGeneratedAt: next.generatedAt,
    cyclePath: "release/evidence/milestones-cycle-last.json",
    cycleRanAt: cycle.ranAt,
  },
  honesty:
    completedMode
      ? "This batch is derived from completed real-build entries in data/next-in-line.json. Completion is evidence-backed by the listed probes and milestones-cycle-last.json."
      : "This batch is derived from real-build entries in data/next-in-line.json. It is not achievement evidence; every item stays blocked until code and tests land.",
  totals: {
    requested: batchSize,
    included: items.length,
    achievedAtSource: next.totals?.achieved ?? cycle.totals?.achieved ?? 0,
    milestonesAtSource: next.totals?.milestones ?? cycle.totals?.milestones ?? 0,
  },
  items,
};

const jsonPath = "data/next-5-batch.json";
writeFileSync(join(root, jsonPath), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

const mdPath = "release/evidence/next-5-batch.md";
mkdirSync(dirname(join(root, mdPath)), { recursive: true });
const lines = [
  "# MAATAA OS Next 5 Batch",
  "",
  `- Batch: \`${payload.batchId}\``,
  `- Generated: ${payload.generatedAt}`,
  `- Source queue: \`${payload.source.queuePath}\` (${payload.source.queueGeneratedAt})`,
  `- Source cycle: \`${payload.source.cyclePath}\` (${payload.source.cycleRanAt})`,
  `- Source tally: ${payload.totals.achievedAtSource}/${payload.totals.milestonesAtSource} achieved`,
  `- Mode: ${payload.mode}`,
  "",
  completedMode
    ? "> This is completed progress evidence. Every item is ACHIEVED only because its listed probe passed and the milestone cycle regenerated."
    : "> This is not progress evidence. Every item is BLOCKED_UNTIL_IMPLEMENTED until real code, focused tests, and regenerated evidence prove it.",
  "",
  "## Items",
  "",
];

for (const item of items) {
  lines.push(
    `### ${item.batchOrder}. ${item.title}`,
    "",
    `- Group: ${item.group}`,
    `- Source rank: ${item.sourceRank}`,
    `- Status: ${item.workStatus}`,
    `- Evidence: ${item.evidenceStatus}`,
    `- Completion probe: ${item.completionProbe ?? "not-yet-assigned"}`,
    `- Completed at: ${item.completedAt ?? "not completed"}`,
    `- Detail: ${item.detail}`,
    `- Required to flip: ${item.requiredToFlip.join("; ")}`,
    "",
  );
}

writeFileSync(join(root, mdPath), `${lines.join("\n")}\n`, "utf8");
console.log(`next batch: wrote ${jsonPath} and ${mdPath} (${items.length} items)`);
