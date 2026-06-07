#!/usr/bin/env node
// System Notice Board — latest news on milestones.
//
// PHKD rule: every notice is derived from a real evidence artifact and carries
// its real timestamp + source. No headline is invented. If a source file is
// absent, its notices are simply omitted (fail closed, never fabricate).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const readJson = (p) => (existsSync(join(root, p)) ? JSON.parse(readFileSync(join(root, p), "utf8")) : null);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const notices = [];

// 1. Verified achievements — newest milestone wins.
const ach = readJson("release/evidence/honest-achievements.json");
if (ach) {
  // Only ACHIEVED probes are news. NOT_ACHIEVED probe results are honest
  // roadmap/"not yet" checks (including fail-closed resolution probes) — they are
  // not regressions and do not belong in the feed.
  for (const a of (ach.achievements || []).filter((x) => x.achievement === "ACHIEVED")) {
    notices.push({
      ts: a.verifiedAt || ach.generatedAt,
      type: a.resolves ? "RESOLVED" : "ACHIEVEMENT",
      title: a.resolves ? `In-progress finished — ${a.futureMilestone}` : `Milestone achieved — ${a.futureMilestone}`,
      detail: a.currentState,
      source: a.verifiedBy || "honest-achievements.json",
    });
  }
}

// 2. Milestone tally snapshot.
const mvc = readJson("data/milestones-vs-current.json");
if (mvc) {
  const t = mvc.totals;
  notices.push({
    ts: mvc.generatedAt,
    type: "STATUS",
    title: `Milestone tally: ${t.achieved} achieved / ${t.milestones} total`,
    detail: `${t.notAchieved} not achieved, ${t.inProgress} in progress, ${t.unverified} unverified, across ${t.universes} universes.`,
    source: "data/milestones-vs-current.json",
  });
}

// 3. Governed production gate posture.
const gate = readJson("release/evidence/governed-production-gate.json");
if (gate) {
  notices.push({
    ts: gate.generatedAt,
    type: gate.productionReady ? "STATUS" : "INTEGRITY",
    title: `Production gate: ${gate.status}`,
    detail: `PHKD verdict ${gate.phkdVerdict}; ${gate.blockers.length} blocker(s). Gate is fail-closed — GO requires hardware root-of-trust evidence.`,
    source: "release/evidence/governed-production-gate.json",
  });
}

// 4. Recent commits — real repository events.
try {
  const log = execFileSync("git", ["log", "--pretty=format:%cI%x09%s", "-6"], { cwd: root, encoding: "utf8" });
  for (const line of log.split("\n").filter(Boolean)) {
    const [ts, ...rest] = line.split("\t");
    notices.push({ ts, type: "COMMIT", title: rest.join("\t"), detail: "", source: "git log" });
  }
} catch {
  /* no git history available */
}

notices.sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));

const BADGE = {
  ACHIEVEMENT: ["ACHIEVED", "#14532d", "#bbf7d0"],
  RESOLVED: ["RESOLVED", "#134e4a", "#99f6e4"],
  REGRESSION: ["REGRESSION", "#7f1d1d", "#fecaca"],
  STATUS: ["STATUS", "#1e3a8a", "#bfdbfe"],
  INTEGRITY: ["INTEGRITY", "#78350f", "#fde68a"],
  COMMIT: ["COMMIT", "#374151", "#e5e7eb"],
};

const fmt = (ts) => {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? esc(ts) : d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
};

const items = notices
  .map((n) => {
    const [label, fg, bg] = BADGE[n.type] || BADGE.STATUS;
    return `<article class="notice">
  <div class="meta"><span class="badge" style="color:${fg};background:${bg}">${label}</span><time>${fmt(n.ts)}</time></div>
  <h3>${esc(n.title)}</h3>
  ${n.detail ? `<p>${esc(n.detail)}</p>` : ""}
  <div class="src">source: ${esc(n.source)}</div>
</article>`;
  })
  .join("\n");

const achievedCount = ach ? ach.totals.achieved : 0;
const generatedAt = new Date().toISOString();
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>MAATAA OS — System Notice Board</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; margin:0; padding:2rem; background:#0b0f14; color:#e5e7eb; line-height:1.45; }
  header { border-bottom:1px solid #1f2937; padding-bottom:1rem; margin-bottom:1.25rem; }
  h1 { margin:0 0 .25rem; font-size:1.5rem; }
  .sub { color:#9ca3af; font-size:.85rem; }
  .honesty { margin-top:.75rem; padding:.6rem .9rem; background:#111827; border-left:3px solid #f59e0b; border-radius:4px; font-size:.82rem; color:#d1d5db; }
  .feed { max-width:820px; }
  .notice { border:1px solid #1f2937; border-radius:10px; padding:.9rem 1.1rem; margin:.75rem 0; background:#0f1620; }
  .notice .meta { display:flex; align-items:center; gap:.6rem; margin-bottom:.35rem; }
  .badge { display:inline-block; padding:.12rem .55rem; border-radius:999px; font-size:.66rem; font-weight:700; letter-spacing:.04em; }
  time { color:#6b7280; font-size:.75rem; }
  .notice h3 { margin:.1rem 0; font-size:.98rem; }
  .notice p { margin:.25rem 0; color:#9ca3af; font-size:.86rem; }
  .src { color:#4b5563; font-size:.72rem; margin-top:.4rem; font-family:ui-monospace,monospace; }
  footer { margin-top:2rem; color:#6b7280; font-size:.74rem; border-top:1px solid #1f2937; padding-top:1rem; max-width:820px; }
</style>
</head>
<body>
<header>
  <h1>MAATAA OS — System Notice Board</h1>
  <div class="sub">Latest news on milestones · generated ${esc(generatedAt)} · ${notices.length} notices · ${achievedCount} milestones achieved</div>
  <div class="honesty">Every notice is derived from a real evidence artifact and carries its actual timestamp and source. No headline is fabricated; absent sources are omitted, not invented.</div>
</header>
<section class="feed">
${items}
</section>
<footer>
  Regenerate: <code>node scripts/verify-honest-achievements.mjs &amp;&amp; node scripts/generate-milestones-matrix.mjs &amp;&amp; node scripts/generate-notice-board.mjs</code>. Notice types: ACHIEVEMENT (verified milestone), REGRESSION (probe now failing), STATUS (tally/posture), INTEGRITY (fail-closed gate), COMMIT (repository event).
</footer>
</body>
</html>
`;

writeFileSync(join(root, "release/SYSTEM_NOTICE_BOARD.html"), html, "utf8");
console.log(`notice board: ${notices.length} notices (${achievedCount} achievements) → release/SYSTEM_NOTICE_BOARD.html`);
