#!/usr/bin/env node
/*
 * Renders the full Lipi 426 master as an evidence timeline.
 *
 * This is a slot/order timeline from the runtime master, not a claim that all
 * 426 scripts are sourced or revived. Reserved slots stay visibly BLOCKED.
 *
 * Run:
 *   node scripts/render-lipi-426-master-timeline.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { lipi426Master, LIPI_426_EXPECTED_COUNT } from "../packages/lipi-runtime/src/data/lipi-426-master.ts";

const root = process.cwd();
const J = (p, fallback) => (existsSync(join(root, p)) ? JSON.parse(readFileSync(join(root, p), "utf8")) : fallback);
const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const enriched = J("data/endangered-scripts-enriched.json", { scripts: [] });
const enrichedById = new Map((enriched.scripts || []).map((s) => [s.id, s]));
const statusOrder = ["ACTIVE", "HISTORICAL", "ENDANGERED", "BLOCKED"];
const byStatus = Object.fromEntries(statusOrder.map((status) => [status, 0]));

const parseStart = (range) => {
  const match = String(range || "").match(/U\+([0-9A-Fa-f]+)/);
  return match ? Number.parseInt(match[1], 16) : null;
};

const entries = lipi426Master.map((script, index) => {
  const normalizedId = String(script.id).replace(/^endangered-/, "");
  const enrichedRecord = enrichedById.get(normalizedId);
  const unicodeRange = script.unicodeRange || enrichedRecord?.unicode?.range || "UNKNOWN";
  const unicodeBlock = enrichedRecord?.unicode?.block || script.family || "UNKNOWN";
  const unicodeStart = parseStart(unicodeRange);
  byStatus[script.status] = (byStatus[script.status] || 0) + 1;
  return {
    slot: index + 1,
    id: script.id,
    name: script.name,
    isoCode: script.isoCode,
    status: script.status,
    vitality: script.vitality || null,
    reviewState: script.reviewState || (script.status === "BLOCKED" ? "BLOCKED" : "CONTROLLED_NO_GO"),
    family: script.family,
    wave: script.wave || "UNSET",
    direction: script.direction,
    region: script.region || "UNKNOWN",
    unicodeRange,
    unicodeBlock,
    unicodeStart,
    unicodeStartLabel: unicodeStart == null ? "NO VERIFIED UNICODE RANGE" : `U+${unicodeStart.toString(16).toUpperCase().padStart(4, "0")}`,
    purpose: script.purpose || "UNKNOWN",
    oldestProof: script.oldestProof || "SOURCE_PROOF_PENDING",
    reserved: script.status === "BLOCKED" && script.id.startsWith("lipi-extension-"),
  };
});

const totals = {
  expected: LIPI_426_EXPECTED_COUNT,
  total: entries.length,
  byStatus,
  sourcedOrNamed: entries.filter((e) => !e.reserved).length,
  reservedEvidenceSlots: entries.filter((e) => e.reserved).length,
  blockedTotal: byStatus.BLOCKED || 0,
  unicodeRangeKnown: entries.filter((e) => e.unicodeStart != null).length,
  unicodeRangeUnknown: entries.filter((e) => e.unicodeStart == null).length,
};

const rows = entries
  .map((e) => {
    const klass = e.reserved ? "reserved" : e.status.toLowerCase();
    return `<tr class="${klass}">
      <td>${e.slot}</td>
      <td>${esc(e.name)}</td>
      <td><code>${esc(e.id)}</code></td>
      <td>${esc(e.isoCode)}</td>
      <td>${esc(e.status)}${e.vitality ? ` / ${esc(e.vitality)}` : ""}</td>
      <td>${esc(e.reviewState)}</td>
      <td>${esc(e.unicodeStartLabel)}<br><span>${esc(e.unicodeRange)}</span></td>
      <td>${esc(e.direction)}</td>
      <td>${esc(e.region)}</td>
      <td>${esc(e.purpose)}</td>
    </tr>`;
  })
  .join("\n");

const evidence = {
  schema: "maataa.lipi.426-master-timeline.v1",
  generatedAt: new Date().toISOString(),
  reviewState: "CONTROLLED_NO_GO",
  governedProductionGo: false,
  honesty:
    "Full 426-slot runtime master. Reserved extension slots are BLOCKED evidence slots, not named scripts. This page does not claim 426 revived or certified scripts.",
  source: "packages/lipi-runtime/src/data/lipi-426-master.ts",
  totals,
  entries,
};

writeFileSync(join(root, "release/evidence/lipi-426-master-timeline.json"), `${JSON.stringify(evidence, null, 2)}\n`);

const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Lipi 426 Master Timeline</title>
  <style>
    body{margin:0;background:#080b10;color:#e5e7eb;font-family:ui-sans-serif,system-ui;padding:24px}
    h1{font-size:25px;margin:0 0 6px;letter-spacing:0}
    .sub{color:#9ca3af;margin:0 0 18px;max-width:1120px}
    .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px}
    .stat{background:#111827;border:1px solid #263244;border-radius:8px;padding:12px}
    .stat b{display:block;font-size:24px}
    .toolbar{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 12px}
    .toolbar input,.toolbar select{background:#0f172a;color:#e5e7eb;border:1px solid #334155;border-radius:7px;padding:9px 10px;font:inherit}
    .toolbar input{min-width:260px;flex:1}
    table{width:100%;border-collapse:collapse;background:#101722;border:1px solid #263244;border-radius:8px;overflow:hidden}
    th,td{text-align:left;vertical-align:top;border-bottom:1px solid #263244;padding:8px;font-size:12px}
    th{position:sticky;top:0;background:#162033;color:#bfdbfe;z-index:1}
    td:first-child{color:#94a3b8;width:46px}
    code{color:#c4b5fd}
    td span{color:#94a3b8}
    tr.reserved{color:#94a3b8}
    tr.reserved td{background:#0b1018}
    tr.active td:nth-child(5){color:#86efac}
    tr.historical td:nth-child(5){color:#fde68a}
    tr.endangered td:nth-child(5){color:#fdba74}
    footer{margin-top:16px;color:#64748b;font-size:12px}
  </style>
</head>
<body>
  <h1>Lipi 426 Master Timeline</h1>
  <p class="sub">All 426 runtime master slots shown in slot order. The 381 extension rows are reserved evidence slots, and Indus remains research-blocked; no certification or revival claim is made.</p>
  <section class="stats">
    <div class="stat"><b>${totals.total}/${totals.expected}</b>master slots</div>
    <div class="stat"><b>${totals.byStatus.ACTIVE || 0}</b>ACTIVE</div>
    <div class="stat"><b>${totals.byStatus.HISTORICAL || 0}</b>HISTORICAL</div>
    <div class="stat"><b>${totals.byStatus.ENDANGERED || 0}</b>ENDANGERED source-claim</div>
    <div class="stat"><b>${totals.blockedTotal}</b>BLOCKED total</div>
    <div class="stat"><b>${totals.reservedEvidenceSlots}</b>reserved extension slots</div>
  </section>
  <div class="toolbar">
    <input id="q" type="search" placeholder="Search name, id, ISO, region">
    <select id="status">
      <option value="">All statuses</option>
      ${statusOrder.map((s) => `<option value="${s}">${s}</option>`).join("")}
      <option value="RESERVED">Reserved extension slots</option>
    </select>
  </div>
  <table id="master">
    <thead><tr><th>Slot</th><th>Name</th><th>ID</th><th>ISO</th><th>Status</th><th>Review</th><th>Unicode</th><th>Dir</th><th>Region</th><th>Purpose</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <footer>Generated ${esc(evidence.generatedAt)} · governedProductionGo=false · blocked rows are visible by design.</footer>
  <script>
    const q = document.getElementById('q');
    const status = document.getElementById('status');
    const rows = [...document.querySelectorAll('#master tbody tr')];
    function apply(){
      const needle = q.value.trim().toLowerCase();
      const st = status.value;
      for (const row of rows) {
        const text = row.innerText.toLowerCase();
        const okText = !needle || text.includes(needle);
        const statusText = row.children[4].innerText;
        const okStatus = !st || (st === 'RESERVED' ? row.classList.contains('reserved') : statusText.includes(st));
        row.style.display = okText && okStatus ? '' : 'none';
      }
    }
    q.addEventListener('input', apply);
    status.addEventListener('change', apply);
  </script>
</body>
</html>
`;

const out = join(root, "release/LIPI_426_MASTER_TIMELINE.html");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`lipi-426-master-timeline: total=${totals.total} active=${totals.byStatus.ACTIVE || 0} historical=${totals.byStatus.HISTORICAL || 0} endangered=${totals.byStatus.ENDANGERED || 0} blocked=${totals.blockedTotal} reserved=${totals.reservedEvidenceSlots}`);
