#!/usr/bin/env node
// Build the dashboard figures manifest: every numeric claim becomes a figure
// the UI can render WITHOUT lying.
//
//   LIVE          — value read from a real runtime/evidence source. Rendered
//                   normally. Currently only the agent count qualifies.
//   REPRESENTATIVE — the board's aspirational number, preserved verbatim but
//                   flagged `live:false` with an "Illustrative" badge so the UI
//                   shows it as a mockup/target, never as a measured stat.
//
// This is the honest reading of "representational numbers in place of live
// numbers": the number still appears, but it can no longer masquerade as live.
//
// Run: node scripts/hkd/build-dashboard-figures.mjs

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const HKD_DIR = "hkd";
const EVIDENCE = "release/evidence/agent-runtime.json";
const OUT = "data/dashboard-figures.json";

// Claims that are genuinely backed by a live source -> { evidenceKey }.
const LIVE_BINDINGS = {
  "c-active-agents-12": { source: EVIDENCE, evidenceKey: "activeAgents", label: "Active Agents" },
};

let liveEvidence = {};
if (existsSync(EVIDENCE)) {
  try { liveEvidence = JSON.parse(readFileSync(EVIDENCE, "utf8")); } catch { /* ignore */ }
}

// Pull the headline portion (after the last colon if present) and a best-effort
// numeric. rawValue is what the UI should DISPLAY for representative figures.
function parseHeadline(text) {
  const seg = text.includes(":") ? text.slice(text.indexOf(":") + 1).trim() : text.trim();
  const m = seg.match(/[\d][\d,]*(?:\.\d+)?\s*(?:[KMB]|da[MK])?\+?%?/i);
  const rawValue = m ? m[0].trim() : null;
  let numeric = null;
  if (m) {
    const mm = m[0].replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*([KMB])?/i);
    if (mm) {
      numeric = parseFloat(mm[1]);
      const mult = { K: 1e3, M: 1e6, B: 1e9 }[(mm[2] || "").toUpperCase()];
      if (mult) numeric *= mult;
    }
  }
  const unit = /%/.test(seg) ? "%" : /\/100\b/.test(seg) ? "/100" : null;
  return { rawValue, numeric, unit };
}

const files = readdirSync(HKD_DIR).filter((f) => f.endsWith(".hkd") && !f.startsWith("._")).sort();
const figures = [];
for (const file of files) {
  let data;
  try { data = JSON.parse(readFileSync(join(HKD_DIR, file), "utf8")); } catch { continue; }
  const universe = data.universe || file.replace(/\.hkd$/, "");
  for (const c of data.claims || []) {
    if (!/\d/.test(c.text || "")) continue;            // only numeric claims
    const { rawValue, numeric, unit } = parseHeadline(c.text);
    const bind = LIVE_BINDINGS[c.id];
    if (bind && liveEvidence[bind.evidenceKey] != null) {
      figures.push({
        claimId: c.id, universe, text: c.text,
        kind: "LIVE", live: true,
        value: String(liveEvidence[bind.evidenceKey]),
        numeric: Number(liveEvidence[bind.evidenceKey]),
        unit: null,
        badge: "LIVE",
        source: bind.source,
      });
    } else {
      figures.push({
        claimId: c.id, universe, text: c.text,
        kind: "REPRESENTATIVE", live: false,
        value: rawValue,           // board's number, shown verbatim
        numeric, unit,
        badge: "Illustrative — not live",
        source: "vision board (aspirational target, not measured)",
        disposition: c.reconciliation?.disposition || null,
      });
    }
  }
}

const live = figures.filter((f) => f.live).length;
const manifest = {
  generatedAt: new Date().toISOString(),
  rule: "Figures with live:false MUST render with the Illustrative badge and never as a measured/live stat.",
  summary: { total: figures.length, live, representative: figures.length - live },
  figures,
};
mkdirSync("data", { recursive: true });
writeFileSync(OUT, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`figures=${figures.length} live=${live} representative=${figures.length - live} -> ${OUT}`);
