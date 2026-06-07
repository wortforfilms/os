#!/usr/bin/env node
// Renders release/MILESTONES_KANBAN.html from data/milestones-vs-current.json.
//
// A live, filterable kanban of every milestone. Columns are the four honest
// statuses. Cards are NOT drag-to-move: status is derived from evidence (a probe
// passing), never set by hand — dragging to "Achieved" would be faking, which the
// PHKD directive forbids. The board refreshes whenever the milestones cycle runs.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const data = JSON.parse(readFileSync(join(root, "data/milestones-vs-current.json"), "utf8"));

const cards = data.milestones.map((m) => ({
  id: m.id,
  g: m.group,
  u: m.universe,
  t: m.futureMilestone,
  c: m.currentState,
  s: m.achievement,
  v: m.sourceClaimStatus,
}));

const groups = (data.byGroup || []).map((g) => g.group);
const wa = (() => {
  try {
    return JSON.parse(readFileSync(join(root, "release/evidence/workers-agents.json"), "utf8"));
  } catch {
    return { workers: [], agents: [], totals: {} };
  }
})();
const nextInLine = (() => {
  try {
    return JSON.parse(readFileSync(join(root, "data/next-in-line.json"), "utf8"));
  } catch {
    return { queue: [], totals: {} };
  }
})();
const payload = JSON.stringify({ cards, groups, byGroup: data.byGroup || [], totals: data.totals, generatedAt: data.generatedAt, wa, nextInLine });

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>MAATAA OS — Milestones Kanban</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; margin:0; padding:1.25rem; background:#0b0f14; color:#e5e7eb; }
  h1 { font-size:1.25rem; margin:0 0 .15rem; }
  .sub { color:#9ca3af; font-size:.8rem; }
  .live { display:inline-flex; align-items:center; gap:.35rem; font-size:.72rem; color:#86efac; margin-left:.5rem; }
  .live .dot { width:8px; height:8px; border-radius:50%; background:#22c55e; animation:pulse 1.4s infinite; }
  .live.stale .dot { background:#f59e0b; } .live.stale { color:#fcd34d; }
  .live.off .dot { background:#6b7280; animation:none; } .live.off { color:#6b7280; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.25} }
  .controls { display:flex; flex-wrap:wrap; gap:.4rem; align-items:center; margin:.9rem 0; }
  .chip { background:#111827; border:1px solid #1f2937; color:#cbd5e1; border-radius:999px; padding:.3rem .7rem; font-size:.78rem; cursor:pointer; }
  .chip.active { background:#1d4ed8; border-color:#1d4ed8; color:#fff; }
  input#q { background:#0f1620; border:1px solid #1f2937; color:#e5e7eb; border-radius:8px; padding:.35rem .6rem; font-size:.8rem; min-width:200px; }
  .board { display:grid; grid-template-columns:repeat(4,1fr); gap:.75rem; align-items:start; }
  .col { background:#0e141c; border:1px solid #1f2937; border-radius:10px; padding:.5rem; min-height:120px; max-height:72vh; overflow-y:auto; }
  .col h2 { font-size:.82rem; margin:0 0 .5rem; display:flex; justify-content:space-between; align-items:center; position:sticky; top:0; background:#0e141c; padding:.2rem 0; z-index:1; }
  .actionbar { display:flex; flex-wrap:wrap; gap:.45rem; margin:.6rem 0 1rem; }
  .act { display:inline-flex; align-items:center; gap:.35rem; background:#11233b; color:#bfdbfe; border:1px solid #1e3a5f; border-radius:7px; padding:.4rem .75rem; font-size:.76rem; font-weight:600; cursor:pointer; }
  .act:hover { background:#16335a; }
  .act.disabled { opacity:.5; cursor:default; }
  .gbar { height:4px; background:#1f2937; border-radius:999px; margin-top:.25rem; overflow:hidden; }
  .gbar > div { height:100%; background:linear-gradient(90deg,#16a34a,#86efac); }
  .col .n { font-size:.72rem; color:#0b0f14; border-radius:999px; padding:.05rem .5rem; font-weight:700; }
  .card { background:#121a24; border:1px solid #1f2937; border-left-width:3px; border-radius:7px; padding:.5rem .6rem; margin-bottom:.5rem; }
  .card .ct { font-size:.8rem; line-height:1.3; }
  .card .meta { font-size:.66rem; color:#6b7280; margin-top:.35rem; display:flex; gap:.4rem; flex-wrap:wrap; }
  .card .tag { background:#1f2937; border-radius:4px; padding:.05rem .35rem; }
  .card .ev { font-size:.68rem; color:#94a3b8; margin-top:.35rem; display:none; }
  .card.open .ev { display:block; }
  .card .ct { cursor:pointer; }
  .ACHIEVED { border-left-color:#22c55e; } .col-ACHIEVED .n { background:#86efac; }
  .IN_PROGRESS { border-left-color:#f59e0b; } .col-IN_PROGRESS .n { background:#fcd34d; }
  .UNVERIFIED { border-left-color:#3b82f6; } .col-UNVERIFIED .n { background:#93c5fd; }
  .NOT_ACHIEVED { border-left-color:#6b7280; } .col-NOT_ACHIEVED .n { background:#d1d5db; }
  .note { color:#6b7280; font-size:.72rem; margin-top:1rem; border-top:1px solid #1f2937; padding-top:.6rem; }
  .wa { background:#0e141c; border:1px solid #1f2937; border-radius:10px; padding:.7rem .8rem; margin:.4rem 0 1rem; }
  .wa h2 { font-size:.85rem; margin:0 0 .5rem; }
  .wa .row { display:flex; flex-wrap:wrap; gap:.45rem; }
  .worker { background:#121a24; border:1px solid #1f2937; border-radius:7px; padding:.35rem .55rem; font-size:.72rem; }
  .worker .wn { color:#e5e7eb; font-weight:600; }
  .worker .wb { color:#86efac; } .worker .wt { color:#6b7280; }
  .worker .pulse { display:inline-block; width:7px; height:7px; border-radius:50%; background:#22c55e; margin-right:.35rem; animation:pulse 1.6s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
  .agent { background:#10231f; border:1px solid #134e4a; border-radius:7px; padding:.4rem .6rem; font-size:.74rem; }
  .agent .an { color:#99f6e4; font-weight:700; }
  .nil { background:#0e141c; border:1px solid #1f2937; border-radius:10px; padding:.7rem .8rem; margin:.4rem 0 1rem; }
  .nil h2 { font-size:.85rem; margin:0 0 .5rem; display:flex; align-items:center; gap:.75rem; }
  .runbtn { background:#1d4ed8; color:#fff; border:none; border-radius:7px; padding:.35rem .8rem; font-size:.78rem; font-weight:700; cursor:pointer; }
  .runbtn:hover { background:#2563eb; }
  .runbtn:disabled { background:#374151; cursor:not-allowed; }
  .runhint { color:#6b7280; font-size:.7rem; }
  .nrow { display:flex; gap:.5rem; align-items:flex-start; padding:.35rem .2rem; border-bottom:1px solid #161c26; font-size:.78rem; }
  .nrank { color:#6b7280; min-width:1.4rem; }
  .nbuild { color:#fcd34d; } .nclaim { color:#9ca3af; }
  .nkind { font-size:.6rem; padding:.05rem .35rem; border-radius:4px; background:#1f2937; color:#cbd5e1; white-space:nowrap; }
  .nd { color:#6b7280; font-size:.7rem; }
  .pipeline { display:flex; flex-wrap:wrap; gap:.35rem; margin-top:.5rem; }
  .pstep { display:flex; align-items:center; gap:.3rem; background:#0f1620; border:1px solid #1f2937; border-radius:6px; padding:.25rem .5rem; font-size:.7rem; color:#cbd5e1; }
  .pstep .pi { width:13px; height:13px; border-radius:3px; display:inline-flex; align-items:center; justify-content:center; font-size:.6rem; font-weight:700; }
  .pstep.ok .pi { background:#22c55e; color:#06240f; } .pstep.ok .pi::after{content:"✓";}
  .pstep.failed .pi { background:#ef4444; color:#2a0606; } .pstep.failed .pi::after{content:"✕";}
  .pstep.pending .pi { background:#374151; color:#9ca3af; } .pstep.pending .pi::after{content:"…";}
  .pstep .pms { color:#6b7280; }
  .pstep .arrow { color:#374151; }
  @media (max-width:900px){ .board{ grid-template-columns:1fr 1fr; } }
</style>
</head>
<body>
<h1>MAATAA OS — Milestones Kanban <span class="live off" id="live"><span class="dot"></span><span id="liveTxt">static</span></span></h1>
<div class="sub" id="sub"></div>
<div class="actionbar" id="actionbar"></div>
<div class="nil" id="nil"></div>
<div class="wa" id="wa"></div>
<div class="controls" id="groupChips"></div>
<div class="controls">
  <input id="q" placeholder="search milestones / universe / evidence…" />
  <span class="sub" id="count"></span>
</div>
<div class="board" id="board"></div>
<div class="note">Live, evidence-derived board (refreshed by <code>npm run milestones</code>). Cards are read-only: status comes from a probe passing, never from dragging — moving a card by hand would be faking. Click a card to see its evidence.</div>
<script>
const D = ${payload};
const COLS = [
  ["NOT_ACHIEVED","Not achieved"],
  ["UNVERIFIED","Unverified"],
  ["IN_PROGRESS","In progress"],
  ["ACHIEVED","Achieved"],
];
let activeGroup = localStorage.getItem("kanbanGroup") || "All";
let query = "";

document.getElementById("sub").textContent =
  D.totals.achieved + " achieved / " + D.totals.milestones + " milestones · " +
  D.totals.groups + " groups · generated " + (D.generatedAt||"").slice(0,16).replace("T"," ");

function renderNIL(){
  const el = document.getElementById("nil");
  const nil = D.nextInLine || { queue: [], totals: {} };
  const rows = (nil.queue || []).map((q) =>
    '<div class="nrow"><span class="nrank">#'+q.rank+'</span>'+
    '<span class="nkind">'+(q.kind==="real-build"?"REAL BUILD":"in-progress")+'</span>'+
    '<span class="'+(q.kind==="real-build"?"nbuild":"nclaim")+'">'+esc(q.title)+
    (q.detail?'<div class="nd">'+esc(q.detail)+'</div>':'')+'</span></div>'
  ).join("");
  // Working button: in a chat widget context, sendPrompt() exists and triggers a batch.
  const canRun = typeof window.sendPrompt === "function";
  el.innerHTML =
    '<h2>Next in line '+
    '<button class="runbtn" id="runBatch">▶ Execute next batch</button>'+
    '<span class="runhint" id="runHint">'+(canRun?"runs the next honest batch":"open in chat to run; or type \\"next batch\\"")+'</span></h2>'+
    (rows || '<span class="runhint">queue empty</span>');
  const btn = document.getElementById("runBatch");
  btn.onclick = () => {
    if (typeof window.sendPrompt === "function") {
      window.sendPrompt("next batch");
      btn.disabled = true; btn.textContent = "▶ batch requested…";
    } else {
      document.getElementById("runHint").textContent = 'type "next batch" in chat to run';
    }
  };
}

function renderWA(){
  const el = document.getElementById("wa");
  const wa = D.wa || { workers:[], agents:[] };
  const agent = (wa.agents||[]).map(a => {
    const steps = (a.steps||[]).map((s,i) =>
      (i? '<span class="arrow">→</span>':'')+
      '<span class="pstep '+esc(s.status)+'"><span class="pi"></span>'+esc(s.label)+
      (s.ms!=null && s.status==="ok" ? ' <span class="pms">'+s.ms+'ms</span>':'')+'</span>'
    ).join("");
    return '<div class="agent"><span class="an">⟳ Maataa milestones cycle</span> — '+esc(a.status)+
      (a.lastRun ? ' · last run '+esc(a.lastRun.slice(0,16).replace("T"," ")) : '')+
      ' · '+esc(a.lastResult)+
      (steps? '<div class="pipeline">'+steps+'</div>':'')+'</div>';
  }).join("");
  const workers = (wa.workers||[]).map(w =>
    '<div class="worker"><span class="pulse"></span><span class="wn">'+esc(w.module.replace(".mjs",""))+'</span> '+
    '<span class="wb">'+w.passing+' passing</span><span class="wt"> / '+w.probes+' probes'+
    (w.resolvers ? ' · '+w.resolvers+' resolvers':'')+'</span></div>'
  ).join("");
  el.innerHTML = '<h2>Active workers & agents '+
    '<span class="sub">('+(wa.totals?wa.totals.totalPassing:0)+'/'+(wa.totals?wa.totals.totalProbes:0)+' probes passing across '+(wa.workers||[]).length+' workers)</span></h2>'+
    (agent?'<div class="row" style="margin-bottom:.5rem">'+agent+'</div>':'')+
    '<div class="row">'+(workers||'<span class="sub">no workers found</span>')+'</div>';
}

function renderActionBar(){
  const el = document.getElementById("actionbar");
  const canRun = typeof window.sendPrompt === "function";
  const acts = [
    ["▶", "Run next batch", "next batch"],
    ["⟳", "Re-verify cycle", "re-run the milestones cycle and report the delta"],
    ["⎘", "Group changes & commit", "group changes and commit"],
    ["⚡", "Fix verifier performance", "fix the verifier performance so the full cycle fits the time budget"],
  ];
  el.innerHTML = acts.map((a,i) =>
    '<button class="act'+(canRun?"":" disabled")+'" data-i="'+i+'">'+a[0]+' '+a[1]+(canRun?" ↗":"")+'</button>'
  ).join("") + (canRun?"":'<span class="runhint">open in chat to use actions; or type the command</span>');
  for (const b of el.querySelectorAll(".act")) {
    b.onclick = () => { if (typeof window.sendPrompt === "function") window.sendPrompt(acts[+b.dataset.i][2]); };
  }
}

function renderChips(){
  const el = document.getElementById("groupChips");
  el.innerHTML = "";
  const counts = Object.fromEntries((D.byGroup||[]).map(g => [g.group, g]));
  ["All", ...D.groups].forEach(g => {
    const b = document.createElement("button");
    b.className = "chip" + (g===activeGroup ? " active":"");
    const gc = counts[g];
    if (gc) {
      const pct = gc.total ? Math.round(gc.achieved/gc.total*100) : 0;
      b.innerHTML = esc(g)+' <span style="opacity:.7">'+gc.achieved+'/'+gc.total+'</span>'+
        '<div class="gbar"><div style="width:'+pct+'%"></div></div>';
    } else {
      b.textContent = g;
    }
    b.onclick = () => { activeGroup = g; localStorage.setItem("kanbanGroup", g); render(); };
    el.appendChild(b);
  });
}

function render(){
  renderChips();
  const board = document.getElementById("board");
  board.innerHTML = "";
  let shown = 0;
  const q = query.trim().toLowerCase();
  for (const [key,label] of COLS){
    const col = document.createElement("div");
    col.className = "col col-"+key;
    const items = D.cards.filter(c =>
      c.s===key &&
      (activeGroup==="All" || c.g===activeGroup) &&
      (!q || (c.t+" "+c.u+" "+c.c+" "+c.id).toLowerCase().includes(q))
    );
    shown += items.length;
    col.innerHTML = '<h2>'+label+' <span class="n">'+items.length+'</span></h2>';
    for (const c of items){
      const card = document.createElement("div");
      card.className = "card "+c.s;
      card.innerHTML = '<div class="ct">'+esc(c.t)+'</div>'+
        '<div class="meta"><span class="tag">'+esc(c.g)+'</span><span class="tag">'+esc(c.u)+'</span>'+
        (c.v==="VERIFIED" ? '<span class="tag" style="color:#86efac">✓ verified</span>':'')+'</div>'+
        '<div class="ev">'+esc(c.c)+'</div>';
      card.querySelector(".ct").onclick = () => card.classList.toggle("open");
      col.appendChild(card);
    }
    board.appendChild(col);
  }
  document.getElementById("count").textContent = shown + " shown";
}
function esc(s){ return String(s==null?"":s).replace(/[&<>]/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[m])); }
document.getElementById("q").addEventListener("input", e => { query = e.target.value; render(); });

// ── Realtime polling ────────────────────────────────────────────────────────
// Re-fetch the evidence JSONs (relative to this file in release/) on an interval
// and re-render when the matrix changes. Works when served over http(s); under
// file:// fetch is usually blocked → we fall back to the embedded snapshot and
// label the board "static". Cards remain read-only/evidence-derived either way.
const liveEl = document.getElementById("live"), liveTxt = document.getElementById("liveTxt");
let lastStamp = D.generatedAt || "";
function setLive(state, txt){ liveEl.className = "live " + state; liveTxt.textContent = txt; }
function ago(iso){ const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000)); return s < 60 ? s + "s ago" : Math.round(s/60) + "m ago"; }
async function refresh(){
  try {
    const [m, wa2, nil2] = await Promise.all([
      fetch("../data/milestones-vs-current.json?_=" + Date.now()).then(r => r.json()),
      fetch("evidence/workers-agents.json?_=" + Date.now()).then(r => r.json()).catch(() => D.wa),
      fetch("../data/next-in-line.json?_=" + Date.now()).then(r => r.json()).catch(() => D.nextInLine),
    ]);
    const changed = (m.generatedAt || "") !== lastStamp;
    D.cards = m.milestones.map(x => ({ id:x.id, g:x.group, u:x.universe, t:x.futureMilestone, c:x.currentState, s:x.achievement, v:x.sourceClaimStatus }));
    D.byGroup = m.byGroup || []; D.totals = m.totals; D.generatedAt = m.generatedAt; D.groups = (m.byGroup||[]).map(g=>g.group);
    D.wa = wa2 || D.wa; D.nextInLine = nil2 || D.nextInLine;
    lastStamp = m.generatedAt || lastStamp;
    setLive(changed ? "" : "", "live · updated " + ago(D.generatedAt));
    renderSub(); renderActionBar(); renderNIL(); renderWA(); render();
  } catch {
    // file:// or offline: keep the embedded snapshot, mark static.
    setLive("off", "static · " + (D.generatedAt ? "snapshot " + ago(D.generatedAt) : "embedded"));
  }
}
function renderSub(){
  document.getElementById("sub").textContent =
    D.totals.achieved + " achieved / " + D.totals.milestones + " milestones · " +
    D.totals.groups + " groups · generated " + (D.generatedAt||"").slice(0,16).replace("T"," ");
}

renderActionBar();
renderNIL();
renderWA();
render();
refresh();
setInterval(refresh, 10000); // poll every 10s
</script>
</body>
</html>
`;

writeFileSync(join(root, "release/MILESTONES_KANBAN.html"), html, "utf8");
console.log(`rendered release/MILESTONES_KANBAN.html (${cards.length} cards, ${groups.length} groups)`);
