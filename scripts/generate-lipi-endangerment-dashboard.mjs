#!/usr/bin/env node
/*
 * Endangerment dashboard surface (REVIEW-ONLY, CONTROLLED_NO_GO).
 *
 * Joins runtime truth (the seeded ENDANGERED records' status/vitality/reviewState,
 * from packages/lipi-runtime/release/evidence/lipi-endangered-scripts.json) with
 * the enriched evidence (Unicode codepoints + sourced native names, from
 * data/endangered-scripts-enriched.json), by normalized script id.
 *
 * Honest scope: this surface renders source-claim evidence and its provenance.
 * It shows NO live metrics, NO certification, NO revival counts. Every script is
 * reviewState CONTROLLED_NO_GO. Outputs are deterministic.
 *
 * Run: node scripts/generate-lipi-endangerment-dashboard.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const J = (p) => {
  if (!existsSync(join(root, p))) throw new Error(`missing input: ${p}`);
  return JSON.parse(readFileSync(join(root, p), "utf8"));
};
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (id) => String(id).replace(/^endangered-/, "");

const runtime = J("packages/lipi-runtime/release/evidence/lipi-endangered-scripts.json");
const enriched = J("data/endangered-scripts-enriched.json");
const enrichedById = new Map(enriched.scripts.map((s) => [s.id, s]));

// ---- Join (runtime is authoritative for status/vitality/reviewState) ---------
const rows = runtime.scripts.map((r) => {
  const e = enrichedById.get(norm(r.id)) || {};
  const u = e.unicode || {};
  return {
    id: r.id,
    name: r.name,
    nativeName: e.nativeName && e.nativeName !== "UNKNOWN" ? e.nativeName : null,
    iso15924: r.iso15924,
    family: e.family ?? "UNKNOWN",
    region: e.region ?? "UNKNOWN",
    direction: e.direction ?? "UNKNOWN",
    status: r.status, // ENDANGERED (runtime LipiStatus)
    vitality: r.vitality, // ENDANGERED|EXTINCT|DORMANT|REVIVING
    reviewState: r.reviewState, // CONTROLLED_NO_GO
    encoded: u.encoded ?? null,
    block: u.block ?? "UNKNOWN",
    range: u.range ?? "UNKNOWN",
    sampleCodepoints: Array.isArray(u.sampleCodepoints) ? u.sampleCodepoints : [],
    provenanceCount: r.provenanceCount ?? 0,
    provenance: Array.isArray(e.provenance) ? e.provenance : [],
  };
});

// Fail closed: every joined row must keep CONTROLLED_NO_GO + carry provenance.
const bad = rows.filter((r) => r.reviewState !== "CONTROLLED_NO_GO" || r.provenanceCount < 1);
if (bad.length) throw new Error(`${bad.length} rows violate review posture/provenance: ${bad.map((r) => r.id).join(", ")}`);

const tally = (key) => rows.reduce((m, r) => ((m[r[key]] = (m[r[key]] ?? 0) + 1), m), {});
const dashboard = {
  schema: "maataa.lipi.endangerment-dashboard.v1",
  generatedAt: new Date().toISOString(),
  reviewState: "CONTROLLED_NO_GO",
  governedProductionGo: false,
  honesty:
    "Review-only surface. Joins seeded ENDANGERED runtime records with sourced Unicode + native-name evidence. " +
    "No live metrics, no certification, no revival counts. Every script is CONTROLLED_NO_GO and source-claim only.",
  inputs: {
    runtime: "packages/lipi-runtime/release/evidence/lipi-endangered-scripts.json",
    enriched: "data/endangered-scripts-enriched.json",
  },
  counts: {
    total: rows.length,
    byVitality: tally("vitality"),
    encoded: rows.filter((r) => r.encoded === true).length,
    notEncoded: rows.filter((r) => r.encoded === false).length,
    nativeNameVerified: rows.filter((r) => r.nativeName).length,
    withSampleCodepoints: rows.filter((r) => r.sampleCodepoints.length > 0).length,
  },
  scripts: rows,
};

writeFileSync(join(root, "release/evidence/lipi-endangerment-dashboard.json"), `${JSON.stringify(dashboard, null, 2)}\n`);

// ---- HTML surface ------------------------------------------------------------
const vitColor = { ENDANGERED: "#ffb24d", EXTINCT: "#ff7a7a", DORMANT: "#c9a6ff", REVIVING: "#7ad19a" };
const card = (r) => `
    <article class="script" data-vitality="${esc(r.vitality)}">
      <div class="glyph">${r.nativeName ? esc(r.nativeName) : '<span class="unk">—</span>'}</div>
      <div class="body">
        <header><h3>${esc(r.name)}</h3><span class="vit" style="--v:${vitColor[r.vitality] || "#9aa"}">${esc(r.vitality)}</span></header>
        <dl>
          <div><dt>ISO 15924</dt><dd>${esc(r.iso15924)}</dd></div>
          <div><dt>Family</dt><dd>${esc(r.family)}</dd></div>
          <div><dt>Region</dt><dd>${esc(r.region)}</dd></div>
          <div><dt>Direction</dt><dd>${esc(r.direction)}</dd></div>
          <div><dt>Unicode</dt><dd>${r.encoded === false ? "NOT ENCODED" : `${esc(r.block)} · ${esc(r.range)}`}</dd></div>
          <div><dt>Native name</dt><dd>${r.nativeName ? esc(r.nativeName) : '<span class="unk">UNKNOWN (unverified)</span>'}</dd></div>
        </dl>
        ${r.sampleCodepoints.length ? `<div class="cps">${r.sampleCodepoints.map((c) => `<span class="cp" title="${esc(c.name)}"><b>${esc(c.char)}</b>${esc(c.cp)}</span>`).join("")}</div>` : '<div class="cps unk">no verified sample codepoints</div>'}
        <div class="prov">${r.provenance.map((p) => `<a href="${esc(p.url)}" rel="noopener noreferrer">source</a>`).join(" · ") || '<span class="unk">no source</span>'}</div>
        <footer class="review">${esc(r.reviewState)}</footer>
      </div>
    </article>`;

const byVit = dashboard.counts.byVitality;
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lipi Endangerment Dashboard — REVIEW ONLY</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.5 system-ui, sans-serif; background: #05060f; color: #e9edf7; }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 28px 20px 60px; }
  .banner { border: 1px solid #ffb24d55; background: #2a1c08; color: #ffcf99; padding: 10px 14px; border-radius: 8px; font-weight: 700; }
  h1 { margin: 18px 0 4px; font-size: 24px; }
  .sub { color: #9aa3b8; max-width: 70ch; }
  .stats { display: flex; flex-wrap: wrap; gap: 10px; margin: 18px 0 8px; }
  .stat { background: #0c1024; border: 1px solid #ffffff14; border-radius: 8px; padding: 10px 14px; }
  .stat b { font-size: 20px; display: block; }
  .stat span { color: #9aa3b8; font-size: 12px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; margin-top: 16px; }
  .script { display: flex; gap: 12px; background: #0a0d1e; border: 1px solid #ffffff12; border-radius: 10px; padding: 12px; }
  .glyph { font-size: 38px; min-width: 56px; text-align: center; align-self: center; }
  .body { flex: 1; min-width: 0; }
  .body header { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  h3 { margin: 0; font-size: 16px; }
  .vit { font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 999px; color: #05060f; background: var(--v); white-space: nowrap; }
  dl { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 10px; margin: 8px 0; }
  dl div { display: flex; flex-direction: column; }
  dt { color: #7f8aa3; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
  dd { margin: 0; font-size: 12px; }
  .cps { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
  .cp { background: #11152e; border: 1px solid #ffffff14; border-radius: 6px; padding: 3px 6px; font-size: 10px; color: #9aa3b8; }
  .cp b { font-size: 16px; color: #e9edf7; margin-right: 4px; }
  .prov a { color: #7ab8ff; font-size: 11px; text-decoration: none; }
  .prov a:hover { text-decoration: underline; }
  .review { margin-top: 8px; font-size: 10px; font-weight: 800; color: #ffb24d; }
  .unk { color: #6b7488; font-style: italic; }
  footer.page { margin-top: 30px; color: #6b7488; font-size: 12px; }
</style></head>
<body><div class="wrap">
  <div class="banner">REVIEW ONLY · CONTROLLED_NO_GO · source-claim evidence — no certification, no live metrics, no revival counts</div>
  <h1>Lipi Endangerment Dashboard</h1>
  <p class="sub">${esc(dashboard.honesty)}</p>
  <div class="stats">
    <div class="stat"><b>${dashboard.counts.total}</b><span>scripts (seeded ENDANGERED)</span></div>
    <div class="stat"><b>${byVit.ENDANGERED || 0}</b><span>endangered</span></div>
    <div class="stat"><b>${byVit.EXTINCT || 0}</b><span>extinct</span></div>
    <div class="stat"><b>${byVit.DORMANT || 0}</b><span>dormant</span></div>
    <div class="stat"><b>${byVit.REVIVING || 0}</b><span>reviving</span></div>
    <div class="stat"><b>${dashboard.counts.encoded}</b><span>Unicode-encoded</span></div>
    <div class="stat"><b>${dashboard.counts.nativeNameVerified}</b><span>native name verified</span></div>
  </div>
  <div class="grid">${rows.map(card).join("")}</div>
  <footer class="page">Generated ${esc(dashboard.generatedAt)} · inputs: ${esc(dashboard.inputs.runtime)} + ${esc(dashboard.inputs.enriched)} · governedProductionGo=false</footer>
</div></body></html>
`;
writeFileSync(join(root, "release/LIPI_ENDANGERMENT_DASHBOARD.html"), html);

console.log(`lipi-endangerment-dashboard: ${rows.length} scripts | encoded ${dashboard.counts.encoded} | nativeVerified ${dashboard.counts.nativeNameVerified} | byVitality ${JSON.stringify(byVit)}`);
console.log("wrote release/evidence/lipi-endangerment-dashboard.json + release/LIPI_ENDANGERMENT_DASHBOARD.html");
