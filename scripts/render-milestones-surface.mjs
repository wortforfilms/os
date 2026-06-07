#!/usr/bin/env node
// Renders release/MILESTONES_VS_CURRENT.html from data/milestones-vs-current.json.
// The surface presents FUTURE MILESTONES (targets) next to REAL CURRENT STATE.
// No target is ever rendered as a live/achieved metric. Regenerable.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const data = JSON.parse(readFileSync(join(root, "data/milestones-vs-current.json"), "utf8"));

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const BADGE = {
  NOT_ACHIEVED: ["NOT ACHIEVED", "#7f1d1d", "#fecaca"],
  IN_PROGRESS: ["IN PROGRESS", "#78350f", "#fde68a"],
  UNVERIFIED: ["UNVERIFIED", "#1e3a8a", "#bfdbfe"],
  ACHIEVED: ["ACHIEVED", "#14532d", "#bbf7d0"],
};

const byUniverse = new Map();
for (const m of data.milestones) {
  if (!byUniverse.has(m.universe)) byUniverse.set(m.universe, []);
  byUniverse.get(m.universe).push(m);
}

// Group universes under their milestone group.
const byGroup = new Map();
for (const [universe, items] of byUniverse.entries()) {
  const group = items[0].group || "Other";
  if (!byGroup.has(group)) byGroup.set(group, []);
  byGroup.get(group).push([universe, items]);
}

const groupOrder = (data.byGroup || []).map((g) => g.group);
const orderedGroups = [...byGroup.keys()].sort((a, b) => {
  const ia = groupOrder.indexOf(a);
  const ib = groupOrder.indexOf(b);
  return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b);
});

const renderRows = (items) =>
  items
    .map((m) => {
      const [label, fg, bg] = BADGE[m.achievement] || BADGE.UNVERIFIED;
      return `<tr>
  <td class="milestone">${esc(m.futureMilestone)}</td>
  <td class="current">${esc(m.currentState)}</td>
  <td><span class="badge" style="color:${fg};background:${bg}">${label}</span></td>
</tr>`;
    })
    .join("\n");

const sections = orderedGroups
  .map((group) => {
    const roll = (data.byGroup || []).find((g) => g.group === group) || {};
    const pct = roll.total ? Math.round((roll.achieved / roll.total) * 100) : 0;
    const subs = byGroup
      .get(group)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(
        ([universe, items]) => `  <section class="universe">
    <h3>${esc(universe)} <span class="count">${items.length}</span></h3>
    <table>
      <thead><tr><th>Future Milestone (target)</th><th>Current State (real)</th><th>Status</th></tr></thead>
      <tbody>
${renderRows(items)}
      </tbody>
    </table>
  </section>`,
      )
      .join("\n");
    const slug = group.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    return `<section class="group" id="g-${slug}">
  <div class="group-head">
    <h2>${esc(group)}</h2>
    <div class="rollup">
      <span class="r-achieved">${roll.achieved || 0} achieved</span> /
      <span>${roll.total || 0} milestones</span>
      <span class="r-dim">· ${roll.inProgress || 0} in progress · ${roll.notAchieved || 0} not achieved · ${roll.universes || 0} universes</span>
      <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
    </div>
  </div>
${subs}
</section>`;
  })
  .join("\n");

const t = data.totals;
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>MAATAA OS — Milestones vs Current Stats</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; margin: 0; padding: 2rem; line-height: 1.45; background:#0b0f14; color:#e5e7eb; }
  header { border-bottom: 1px solid #1f2937; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  h1 { margin: 0 0 .25rem; font-size: 1.5rem; }
  .sub { color:#9ca3af; font-size:.85rem; }
  .honesty { margin-top: .75rem; padding:.75rem 1rem; background:#111827; border-left:3px solid #f59e0b; border-radius:4px; font-size:.85rem; color:#d1d5db; }
  .totals { display:flex; flex-wrap:wrap; gap:1rem; margin:1.25rem 0; }
  .stat { background:#111827; border:1px solid #1f2937; border-radius:8px; padding:.75rem 1rem; min-width:120px; }
  .stat .n { font-size:1.4rem; font-weight:700; }
  .stat .l { font-size:.72rem; color:#9ca3af; text-transform:uppercase; letter-spacing:.04em; }
  section.group { margin: 2.25rem 0; }
  .group-head { position:sticky; top:0; background:#0b0f14; padding:.5rem 0; border-bottom:2px solid #334155; margin-bottom:.5rem; z-index:1; }
  .group-head h2 { font-size:1.15rem; margin:0; border:none; }
  .rollup { font-size:.8rem; color:#cbd5e1; margin-top:.25rem; }
  .rollup .r-achieved { color:#86efac; font-weight:700; }
  .rollup .r-dim { color:#6b7280; }
  .bar { height:6px; background:#1f2937; border-radius:999px; margin-top:.4rem; overflow:hidden; max-width:480px; }
  .bar-fill { height:100%; background:linear-gradient(90deg,#16a34a,#86efac); border-radius:999px; }
  section.universe { margin: 1rem 0 1rem .5rem; padding-left:.75rem; border-left:2px solid #161c26; }
  h3 { font-size:.92rem; text-transform:capitalize; color:#e2e8f0; margin:.6rem 0 .35rem; }
  .count { color:#6b7280; font-size:.72rem; font-weight:400; }
  .groupgrid { display:flex; flex-wrap:wrap; gap:.6rem; margin:1rem 0 .5rem; }
  .gchip { background:#111827; border:1px solid #1f2937; border-radius:8px; padding:.5rem .75rem; font-size:.78rem; min-width:150px; }
  .gchip .gn { font-weight:700; color:#e5e7eb; display:block; }
  .gchip .gm { color:#86efac; } .gchip .gt { color:#6b7280; }
  table { width:100%; border-collapse:collapse; font-size:.85rem; }
  th { text-align:left; color:#9ca3af; font-weight:600; padding:.4rem .5rem; border-bottom:1px solid #1f2937; font-size:.75rem; text-transform:uppercase; letter-spacing:.03em; }
  td { padding:.45rem .5rem; border-bottom:1px solid #161c26; vertical-align:top; }
  td.milestone { color:#e5e7eb; width:38%; }
  td.current { color:#9ca3af; width:48%; }
  .badge { display:inline-block; padding:.15rem .5rem; border-radius:999px; font-size:.68rem; font-weight:700; letter-spacing:.03em; white-space:nowrap; }
  footer { margin-top:2rem; color:#6b7280; font-size:.75rem; border-top:1px solid #1f2937; padding-top:1rem; }
</style>
</head>
<body>
<header>
  <h1>MAATAA OS — Milestones vs Current Stats</h1>
  <div class="sub">Generated ${esc(data.generatedAt)} · source ${esc(data.source)} · content hash ${esc((data.contentHash || "").slice(0, 16))}…</div>
  <div class="honesty">${esc(data.honesty)}</div>
</header>
<div class="totals">
  <div class="stat"><div class="n">${t.milestones}</div><div class="l">Total milestones</div></div>
  <div class="stat"><div class="n">${t.universes}</div><div class="l">Universes</div></div>
  <div class="stat"><div class="n" style="color:#86efac">${t.achieved}</div><div class="l">Achieved</div></div>
  <div class="stat"><div class="n" style="color:#fca5a5">${t.notAchieved}</div><div class="l">Not achieved</div></div>
  <div class="stat"><div class="n" style="color:#fcd34d">${t.inProgress}</div><div class="l">In progress</div></div>
  <div class="stat"><div class="n" style="color:#93c5fd">${t.unverified}</div><div class="l">Unverified</div></div>
  <div class="stat"><div class="n">${t.groups ?? (data.byGroup || []).length}</div><div class="l">Groups</div></div>
</div>
<div class="groupgrid">
${(data.byGroup || [])
  .map(
    (g) =>
      `  <a class="gchip" href="#g-${esc(g.group.replace(/[^a-z0-9]+/gi, "-").toLowerCase())}"><span class="gn">${esc(g.group)}</span><span class="gm">${g.achieved} achieved</span> <span class="gt">/ ${g.total}</span></a>`,
  )
  .join("\n")}
</div>
${sections}
<footer>
  PHKD honesty: targets are aspirational and are never presented as live metrics. Current state is sourced verbatim from HKD board evidence. Regenerate with <code>node scripts/generate-milestones-matrix.mjs &amp;&amp; node scripts/render-milestones-surface.mjs</code>.
</footer>
</body>
</html>
`;

writeFileSync(join(root, "release/MILESTONES_VS_CURRENT.html"), html, "utf8");
console.log(`rendered release/MILESTONES_VS_CURRENT.html (${data.milestones.length} rows, ${t.universes} universes)`);
