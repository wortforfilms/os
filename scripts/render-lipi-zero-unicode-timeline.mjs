#!/usr/bin/env node
/*
 * Renders a review-only Unicode block timeline for every current Lipi revival
 * candidate. This is NOT a historical evolution timeline; it is sorted by
 * Unicode range start and keeps all certification counts at their measured zero.
 *
 * Run:
 *   node scripts/render-lipi-zero-unicode-timeline.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const J = (p, fallback) => (existsSync(join(root, p)) ? JSON.parse(readFileSync(join(root, p), "utf8")) : fallback);
const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const enriched = J("data/endangered-scripts-enriched.json", { scripts: [] });
const progress = J("release/evidence/lipi-revival-progress.json", {
  measured: {
    revivedScripts: 0,
    certifiedCorpusTexts: 0,
    targets: { revivedScripts: 50, corpusTexts: 1000 },
    certifiedCorpusLinks: [],
    rawCorpusLinks: [],
  },
});

const rawByScript = new Map((progress.measured.rawCorpusLinks || []).map((x) => [x.scriptId, x.count]));
const certifiedByScript = new Map((progress.measured.certifiedCorpusLinks || []).map((x) => [x.scriptId, x.count]));
const parseStart = (range) => {
  const match = String(range || "").match(/U\+([0-9A-Fa-f]+)/);
  return match ? Number.parseInt(match[1], 16) : Number.POSITIVE_INFINITY;
};
const hex = (n) => (Number.isFinite(n) ? `U+${n.toString(16).toUpperCase().padStart(4, "0")}` : "NO UNICODE SAMPLE");

const entries = (enriched.scripts || [])
  .map((script) => {
    const start = parseStart(script.unicode?.range);
    return {
      id: script.id,
      name: script.name,
      iso15924: script.iso15924 || "UNKNOWN",
      vitality: script.vitality || "UNKNOWN",
      direction: script.direction || "UNKNOWN",
      unicodeEncoded: script.unicode?.encoded === true,
      unicodeBlock: script.unicode?.block || "NO UNICODE SAMPLE",
      unicodeRange: script.unicode?.range || "NO UNICODE SAMPLE",
      unicodeStart: Number.isFinite(start) ? start : null,
      unicodeStartLabel: hex(start),
      sample: (script.unicode?.sampleCodepoints || []).map((cp) => `${cp.char} ${cp.cp}`).join(" "),
      rawCorpusTexts: rawByScript.get(script.id) || 0,
      certifiedCorpusTexts: certifiedByScript.get(script.id) || 0,
      revived: 0,
      certifiedScript: 0,
      provenanceCount: (script.provenance || []).length,
    };
  })
  .sort((a, b) => (a.unicodeStart ?? Number.POSITIVE_INFINITY) - (b.unicodeStart ?? Number.POSITIVE_INFINITY) || a.name.localeCompare(b.name));

const totals = {
  scripts: entries.length,
  unicodeEncoded: entries.filter((e) => e.unicodeEncoded).length,
  unicodeMissing: entries.filter((e) => !e.unicodeEncoded).length,
  revivedScripts: progress.measured.revivedScripts || 0,
  certifiedCorpusTexts: progress.measured.certifiedCorpusTexts || 0,
  rawCorpusTexts: progress.measured.corpusTexts || 0,
  allScriptsZeroCertified: entries.every((e) => e.certifiedCorpusTexts === 0 && e.certifiedScript === 0),
};

const evidence = {
  schema: "maataa.lipi.zero-unicode-timeline.v1",
  generatedAt: new Date().toISOString(),
  reviewState: "CONTROLLED_NO_GO",
  governedProductionGo: false,
  honesty:
    "Unicode block timeline only, sorted by Unicode range start. This is not a historical script-evolution timeline and makes no certification or revival claim.",
  inputs: {
    enriched: "data/endangered-scripts-enriched.json",
    progress: "release/evidence/lipi-revival-progress.json",
  },
  totals,
  entries,
};

writeFileSync(join(root, "release/evidence/lipi-zero-unicode-timeline.json"), `${JSON.stringify(evidence, null, 2)}\n`);

const rows = entries
  .map((e, index) => {
    const cls = e.unicodeEncoded ? "encoded" : "missing";
    return `<article class="item ${cls}">
      <div class="rail"><span>${index + 1}</span></div>
      <div class="body">
        <header>
          <h3>${esc(e.name)}</h3>
          <span class="pill">${esc(e.vitality)}</span>
        </header>
        <div class="meta">
          <span>${esc(e.unicodeStartLabel)}</span>
          <span>${esc(e.unicodeBlock)}</span>
          <span>${esc(e.unicodeRange)}</span>
          <span>ISO ${esc(e.iso15924)}</span>
          <span>${esc(e.direction)}</span>
        </div>
        <div class="sample">${e.sample ? esc(e.sample) : "No verified sample codepoint yet"}</div>
        <div class="zeros">
          <span>script certified: <b>0</b></span>
          <span>revived: <b>0</b></span>
          <span>certified texts: <b>${e.certifiedCorpusTexts}</b></span>
          <span>raw texts: <b>${e.rawCorpusTexts}</b></span>
        </div>
      </div>
    </article>`;
  })
  .join("\n");

const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Lipi Zero Unicode Timeline</title>
  <style>
    body{margin:0;background:#080b10;color:#e5e7eb;font-family:ui-sans-serif,system-ui;padding:24px}
    h1{font-size:25px;margin:0 0 6px;letter-spacing:0}
    .sub{color:#9ca3af;margin:0 0 18px;max-width:980px}
    .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin:0 0 18px}
    .stat{background:#111827;border:1px solid #263244;border-radius:8px;padding:12px}
    .stat b{display:block;font-size:24px}
    .timeline{position:relative;display:grid;gap:10px}
    .timeline:before{content:"";position:absolute;left:23px;top:0;bottom:0;width:2px;background:#334155}
    .item{position:relative;display:grid;grid-template-columns:48px 1fr;gap:10px}
    .rail{display:flex;justify-content:center;padding-top:16px;z-index:1}
    .rail span{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:#1f2937;border:1px solid #475569;font-size:12px;color:#cbd5e1}
    .body{border:1px solid #263244;background:#101722;border-radius:8px;padding:13px}
    .missing .body{border-color:#7f1d1d}
    header{display:flex;gap:10px;align-items:center;justify-content:space-between;margin-bottom:8px}
    h3{font-size:16px;margin:0}
    .pill{font-size:12px;color:#dbeafe;background:#172554;border:1px solid #1e40af;border-radius:999px;padding:3px 8px}
    .meta,.zeros{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
    .meta span,.zeros span{font-size:12px;border:1px solid #334155;background:#0f172a;border-radius:999px;padding:4px 8px;color:#cbd5e1}
    .sample{font-size:18px;line-height:1.4;color:#f8fafc;margin:8px 0;word-break:break-word}
    footer{margin-top:16px;color:#64748b;font-size:12px}
  </style>
</head>
<body>
  <h1>Lipi Zero Unicode Timeline</h1>
  <p class="sub">All current revival candidates shown at zero certification, sorted by Unicode block start. This is a Unicode-range timeline, not a historical evolution timeline.</p>
  <section class="stats">
    <div class="stat"><b>${totals.scripts}</b>script candidates</div>
    <div class="stat"><b>${totals.unicodeEncoded}</b>Unicode encoded</div>
    <div class="stat"><b>${totals.unicodeMissing}</b>missing Unicode sample</div>
    <div class="stat"><b>${totals.revivedScripts}</b>revived scripts</div>
    <div class="stat"><b>${totals.certifiedCorpusTexts}</b>certified corpus texts</div>
    <div class="stat"><b>${totals.rawCorpusTexts}</b>raw review-pending texts</div>
  </section>
  <main class="timeline">${rows}</main>
  <footer>Generated ${esc(evidence.generatedAt)} · governedProductionGo=false · all certification remains CONTROLLED_NO_GO.</footer>
</body>
</html>
`;

const out = join(root, "release/LIPI_ZERO_UNICODE_TIMELINE.html");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`lipi-zero-unicode-timeline: scripts=${totals.scripts} encoded=${totals.unicodeEncoded} zeroCertified=${totals.allScriptsZeroCertified}`);
