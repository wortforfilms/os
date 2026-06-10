#!/usr/bin/env node
// Claim reconciliation pass over the HKD vision boards.
//
// The gate (scripts/evidence-generate.mjs) counts a claim as a production
// blocker only when status === "BLOCKED"; PARTIAL and UNVERIFIED do not block.
// This pass triages every BLOCKED claim using ONLY the claim's own authored
// blockedReason — it invents nothing:
//
//   PARTIAL  : the reason itself cites a real repo artifact (a package, runtime,
//              path, test, or "provides/primitives/exists" language). The claim
//              has genuine partial backing — same precedent as the existing
//              c-research-agent-real / c-lipi-agent-real entries.
//   ROADMAP  : the reason admits the metric is fabricated / "no X exists". Stays
//              BLOCKED, but tagged so the dashboard stops presenting it as a live
//              stat. Honest future target, not a current truth.
//   REVIEW   : neither signal — stays BLOCKED, flagged for a human.
//
// Run dry (default, writes nothing):
//   node scripts/hkd/reconcile-claims.mjs
// Apply (reclassifies PARTIAL, tags the rest, writes files + report):
//   node scripts/hkd/reconcile-claims.mjs --apply

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const APPLY = process.argv.includes("--apply");
const HKD_DIR = "hkd";
const REPORT_DIR = "release/evidence";

// Provenance claims about a missing source image — never a backing signal.
const SOURCE_MISSING = /no matching PNG|Absorbed from operator prompt/i;
// AFFIRMATIVE backing: the reason positively states a real artifact implements
// part of the claim. Negations like "No quantum primitives" do NOT match here.
const AFFIRM = /\(real\)|is real\b|exists on disk|package-level implementation|provides [^.]*?(substrate|primitives|search|learning|RAG)|real in lipi|contains [^.]*?(SovereignDashboard|hkd-generator|schema\.prisma|data\.ts|knowledge corpus|observatory)|has [^.]*?(prisma|hkd-generator|knowledge primitives|SovereignDashboard|search)|re-exports some modules|technically available|tracks [^.]*?(fewer|tiny scale)|AI primitives live inside|Transliteration is real/i;
const FABRICATED = /fabricat|no .{0,40}exists|does not exist|no evidence|invented|made[- ]?up|placeholder|marketing language|no .{0,30}(runtime|registry|marketplace|deploy|primitives|implementation|services|compiler|quantum|audio|voice)/i;

function classify(claim) {
  if (claim.status !== "BLOCKED") return { disposition: "KEEP", to: claim.status };
  const reason = claim.blockedReason || "";
  if (SOURCE_MISSING.test(reason)) {
    return { disposition: "REVIEW", to: "BLOCKED", rationale: "provenance/source-missing claim; needs human review" };
  }
  // Exclude even affirmative-looking reasons when the author flags the number
  // itself as fabricated, or when the cited artifact is unrelated to the claim
  // (e.g. text search cited under a voice claim).
  const PARTIAL_VETO = /\bfabricat/i.test(reason) || /no voice|no stt|no tts|no audio/i.test(reason);
  if (AFFIRM.test(reason) && !PARTIAL_VETO) {
    return { disposition: "PARTIAL", to: "PARTIAL", rationale: "blockedReason affirmatively cites real repo backing" };
  }
  if (FABRICATED.test(reason)) {
    return { disposition: "ROADMAP", to: "BLOCKED", rationale: "fabricated current-stat; move to roadmap/vision, keep blocked" };
  }
  return { disposition: "REVIEW", to: "BLOCKED", rationale: "no clear signal; needs human review" };
}

const files = readdirSync(HKD_DIR).filter((f) => f.endsWith(".hkd") && !f.startsWith("._")).sort();
const summary = { files: 0, totalClaims: 0, before: { BLOCKED: 0, PARTIAL: 0, UNVERIFIED: 0 }, dispositions: { PARTIAL: 0, ROADMAP: 0, REVIEW: 0, KEEP: 0 } };
const perFile = [];
const examples = { PARTIAL: [], ROADMAP: [], REVIEW: [] };

for (const file of files) {
  const path = join(HKD_DIR, file);
  let data;
  try { data = JSON.parse(readFileSync(path, "utf8")); } catch { continue; }
  const claims = Array.isArray(data.claims) ? data.claims : [];
  if (!claims.length) continue;
  summary.files += 1;
  let toPartial = 0, roadmap = 0, review = 0, fileBlockedBefore = 0;
  for (const c of claims) {
    summary.totalClaims += 1;
    if (c.status in summary.before) summary.before[c.status] += 1;
    if (c.status === "BLOCKED") fileBlockedBefore += 1;
    const d = classify(c);
    summary.dispositions[d.disposition] += 1;
    if (d.disposition === "PARTIAL") {
      toPartial += 1;
      if (examples.PARTIAL.length < 6) examples.PARTIAL.push({ id: c.id, text: c.text, reason: c.blockedReason });
      if (APPLY) {
        c.status = "PARTIAL";
        c.reconciliation = { disposition: "PARTIAL", rationale: d.rationale, at: new Date().toISOString() };
      }
    } else if (d.disposition === "ROADMAP") {
      roadmap += 1;
      if (examples.ROADMAP.length < 6) examples.ROADMAP.push({ id: c.id, text: c.text, reason: c.blockedReason });
      if (APPLY) c.reconciliation = { disposition: "ROADMAP", rationale: d.rationale, at: new Date().toISOString() };
    } else if (d.disposition === "REVIEW") {
      review += 1;
      if (examples.REVIEW.length < 6) examples.REVIEW.push({ id: c.id, text: c.text, reason: c.blockedReason });
      if (APPLY) c.reconciliation = { disposition: "REVIEW", rationale: d.rationale, at: new Date().toISOString() };
    }
  }
  perFile.push({ file, blockedBefore: fileBlockedBefore, toPartial, roadmap, review, blockedAfter: fileBlockedBefore - toPartial });
  if (APPLY) writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

const blockedBefore = summary.before.BLOCKED;
const blockedAfter = blockedBefore - summary.dispositions.PARTIAL;
const report = {
  generatedAt: new Date().toISOString(),
  mode: APPLY ? "APPLIED" : "DRY_RUN",
  files: summary.files,
  totalClaims: summary.totalClaims,
  statusBefore: summary.before,
  dispositions: summary.dispositions,
  hkdBlockers: { before: blockedBefore, after: blockedAfter, reducedBy: summary.dispositions.PARTIAL },
  note: "Only BLOCKED->PARTIAL reduces gate blockers. ROADMAP/REVIEW stay BLOCKED until the dashboard stops presenting them as live (ROADMAP) or a human decides (REVIEW).",
  examples,
  perFile: perFile.sort((a, b) => b.toPartial - a.toPartial),
};

if (APPLY) {
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(join(REPORT_DIR, "claim-reconciliation.json"), `${JSON.stringify(report, null, 2)}\n`);
}

console.log(JSON.stringify({ mode: report.mode, files: report.files, totalClaims: report.totalClaims,
  dispositions: report.dispositions, hkdBlockers: report.hkdBlockers }, null, 2));
