#!/usr/bin/env node
/*
 * Renders the review-only queue for "Revive 50+ lipis & 1000+ texts".
 *
 * Run:
 *   node scripts/render-lipi-revival-queue.mjs
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
const progress = J("release/evidence/lipi-revival-progress.json", { measured: { targets: { revivedScripts: 50, corpusTexts: 1000 } }, blockers: [] });
const corpus = J("data/lipi-corpus-texts.json", { texts: [] });
const panini = J("release/evidence/panini-corpus-import.json", null);
const kharosthiPacket = J("release/evidence/kharosthi-review-packet.json", null);
const indianEpigraphy = J("release/evidence/indian-epigraphy-source-proof.json", null);
const reviewInvitations = J("data/lipi-review-invitations.json", { invitations: [] });
const reviewCertifications = J("data/lipi-review-certifications.json", { certifications: [] });

const targets = progress.measured.targets || { revivedScripts: 50, corpusTexts: 1000 };
const rawCorpusTexts = progress.measured.corpusTexts || 0;
const certifiedCorpusTexts = progress.measured.certifiedCorpusTexts || 0;
const seededScripts = progress.measured.scriptsSeeded || (enriched.scripts || []).length;
const revivedScripts = progress.measured.revivedScripts || 0;
const openSlots = Math.max(0, targets.revivedScripts - seededScripts);
const corpusByScript = new Map();
const certifiedCorpusByScript = new Map();
const acceptedCertifiedTextIds = new Set(
  (reviewCertifications.certifications || [])
    .filter((c) => c.status === "ACCEPTED" && c.decision === "CERTIFY_TEXT" && c.evidenceHash)
    .map((c) => c.candidateTextId),
);
const isCertifiedText = (text) =>
  text.reviewState === "CERTIFIED" &&
  (text.provenance || []).length >= 1 &&
  acceptedCertifiedTextIds.has(text.id);
for (const text of corpus.texts || []) {
  corpusByScript.set(text.scriptId, (corpusByScript.get(text.scriptId) || 0) + 1);
  if (isCertifiedText(text)) certifiedCorpusByScript.set(text.scriptId, (certifiedCorpusByScript.get(text.scriptId) || 0) + 1);
}

const scriptRows = (enriched.scripts || [])
  .map((s, index) => {
    const evidenced = [
      (s.provenance || []).length >= 2 ? "2 sources" : `${(s.provenance || []).length} source`,
      s.unicode?.encoded ? "Unicode" : "",
      s.nativeName && s.nativeName !== "UNKNOWN" ? "endonym" : "",
      (corpusByScript.get(s.id) || 0) > 0 ? `${corpusByScript.get(s.id)} raw corpus text(s)` : "",
      (certifiedCorpusByScript.get(s.id) || 0) > 0 ? `${certifiedCorpusByScript.get(s.id)} certified corpus text(s)` : "",
    ]
      .filter(Boolean)
      .join(", ");
    const still = [
      "CERTIFIED review",
      !(s.nativeName && s.nativeName !== "UNKNOWN") ? "verified endonym" : "",
      !s.unicode?.encoded ? "Unicode sample" : "",
      (certifiedCorpusByScript.get(s.id) || 0) < 1 ? ">=1 certified text" : "",
    ]
      .filter(Boolean)
      .join(", ");
    return `<tr><td>${index + 1}</td><td>${esc(s.name)}</td><td>${esc(s.iso15924 || "UNKNOWN")}</td><td>${esc(s.vitality || "UNKNOWN")}</td><td>${esc(evidenced || "none yet")}</td><td>${esc(still || "review certification")}</td><td>20 certified texts target</td></tr>`;
  })
  .join("\n");

const openRows = Array.from({ length: openSlots }, (_, i) => {
  const n = seededScripts + i + 1;
  return `<tr><td>${n}</td><td>OPEN SCRIPT SLOT ${String(i + 1).padStart(2, "0")}</td><td>UNKNOWN</td><td>NEEDS SOURCING</td><td>none yet</td><td>source record + 2 authorities + Unicode/endonym/review + text</td><td>20 certified texts target</td></tr>`;
}).join("\n");

const paniniRows = (corpus.texts || [])
  .filter((t) => t.id.startsWith("panini-ashtadhyayi-"))
  .map(
    (t, i) =>
      `<tr><td>${i + 1}</td><td>${esc(t.title)}</td><td>${esc(t.scriptId)}</td><td>${esc(t.language)}</td><td>${esc(t.text)}</td><td>${esc(t.reviewState)}</td><td>${esc(t.textHash)}</td></tr>`,
  )
  .join("\n");

const kharosthiRows = (corpus.texts || [])
  .filter((t) => t.scriptId === "kharosthi")
  .map(
    (t, i) =>
      `<tr><td>${i + 1}</td><td>${esc(t.title)}</td><td>${esc(t.language)}</td><td>${esc(t.text)}</td><td>${esc(t.reviewState)}</td><td>${esc(t.certificationStatus || "UNKNOWN")}</td><td>${esc(t.textHash)}</td></tr>`,
  )
  .join("\n");

const invitationRows = (reviewInvitations.invitations || [])
  .map(
    (invite, i) =>
      `<tr><td>${i + 1}</td><td>${esc(invite.reviewerRole)}</td><td>${esc(invite.status)}</td><td>${esc(invite.deliveryStatus)}</td><td>${esc(invite.contact)}</td><td>${esc(invite.requestedDecision)}</td></tr>`,
  )
  .join("\n");

const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Lipi Revival Queue</title>
  <style>
    body{margin:0;background:#090d14;color:#e5e7eb;font-family:ui-sans-serif,system-ui;padding:24px}
    h1{margin:0 0 6px;font-size:25px;letter-spacing:0}
    h2{font-size:17px;margin:24px 0 10px}
    .sub{color:#94a3b8;margin-bottom:18px}
    .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:18px}
    .stat{background:#111827;border:1px solid #263244;border-radius:8px;padding:12px}
    .stat b{font-size:24px;display:block}
    .gate{border-left:5px solid #3b82f6}.bad{border-left-color:#ef4444}.ok{border-left-color:#22c55e}.warn{border-left-color:#f59e0b}
    table{width:100%;border-collapse:collapse;background:#101722;border:1px solid #263244;border-radius:8px;overflow:hidden}
    th,td{text-align:left;vertical-align:top;border-bottom:1px solid #263244;padding:9px;font-size:13px}
    th{position:sticky;top:0;background:#162033;color:#bfdbfe}
    td:nth-child(1){color:#94a3b8;width:42px}
    .panel{margin:18px 0;padding:14px;border:1px solid #263244;background:#111827;border-radius:8px}
    .panel li{margin:6px 0}
    .note{color:#cbd5e1}
    footer{margin-top:16px;color:#64748b;font-size:12px}
  </style>
</head>
<body>
  <h1>Revive 50+ Lipis &amp; 1000+ Texts</h1>
  <div class="sub">Evidence-based queue generated from data/endangered-scripts-enriched.json, data/lipi-corpus-texts.json, and release/evidence/lipi-revival-progress.json. No revival claim yet.</div>
  <section class="stats">
    <div class="stat gate"><b>${seededScripts}/${targets.revivedScripts}</b>seeded script candidates</div>
    <div class="stat bad"><b>${revivedScripts}/${targets.revivedScripts}</b>revived scripts</div>
    <div class="stat warn"><b>${rawCorpusTexts}</b>raw review-pending corpus texts</div>
    <div class="stat bad"><b>${certifiedCorpusTexts}/${targets.corpusTexts}</b>certified corpus texts</div>
    <div class="stat warn"><b>${reviewInvitations.invitations?.length || 0}</b>Kharosthi review invites ready</div>
    <div class="stat gate"><b>${openSlots}</b>more sourced script slots needed</div>
  </section>
  <div class="panel">
    <strong>Counts as REVIVED only when all 5 are true:</strong>
    <ol>
      <li>certified-review: reviewState === 'CERTIFIED'</li>
      <li>verified-endonym: nativeName !== 'UNKNOWN' with provenance</li>
      <li>unicode-encoded: unicode.encoded === true with &gt;=1 verified sample codepoint</li>
      <li>second-source: provenance.length &gt;= 2 distinct authorities</li>
      <li>corpus-link: &gt;=1 corpus text references this scriptId</li>
    </ol>
    <p class="note">Text allocation: 1000 certified corpus texts = 20 certified texts per 50 revived scripts. Raw imports are visible, but only CERTIFIED texts count toward the 1000.</p>
  </div>
  <div class="panel">
    <strong>Panini source import</strong>
    <p class="note">User-supplied PDF registered as source proof: The Ashtadhyayi Of Panini (${esc(panini?.sources?.[0]?.sourceUrl || "source pending")}). Imported ${panini?.importedTextRecords || 0} Sanskrit/Devanagari teaching examples as CONTROLLED_NO_GO corpus candidates. The ${panini?.declaredStubCandidates || 0} Ashtadhyayi placeholders remain excluded until each has aligned source text and a hash.</p>
  </div>
  <div class="panel">
    <strong>Kharosthi review packet</strong>
    <p class="note">Prepared ${kharosthiPacket?.reviewInvitationsReadyToSend || 0} review invitations and ${kharosthiPacket?.rawKharosthiCorpusCandidates || 0} Kharosthi-linked corpus candidate. Certified Kharosthi corpus texts remain ${kharosthiPacket?.certifiedKharosthiCorpusTexts || 0}; no external invitation was sent because contacts are still TO_BE_ASSIGNED.</p>
    <p class="note">Source proof added: ${esc(indianEpigraphy?.source?.title || "Indian Epigraphy source proof pending")} · pages ${esc(indianEpigraphy?.source?.observedPages || "UNKNOWN")} · hash ${esc((indianEpigraphy?.source?.sha256 || "UNKNOWN").slice(0, 16))}… · certification effect: ${esc(indianEpigraphy?.certificationEffect || "NONE_BY_ITSELF")}.</p>
  </div>
  <h2>50 Lipi Queue</h2>
  <table><thead><tr><th>#</th><th>Lipi</th><th>ISO</th><th>Vitality</th><th>Already evidenced</th><th>Still needed before REVIVED</th><th>Text target</th></tr></thead><tbody>${scriptRows}${openRows}</tbody></table>
  <h2>Panini Corpus Candidates</h2>
  <table><thead><tr><th>#</th><th>Text</th><th>Script</th><th>Lang</th><th>Content</th><th>Review</th><th>Hash</th></tr></thead><tbody>${paniniRows || `<tr><td colspan="7">No Panini corpus candidates imported yet.</td></tr>`}</tbody></table>
  <h2>Kharosthi Corpus Candidate</h2>
  <table><thead><tr><th>#</th><th>Text</th><th>Lang</th><th>Content</th><th>Review</th><th>Certification</th><th>Hash</th></tr></thead><tbody>${kharosthiRows || `<tr><td colspan="7">No Kharosthi corpus candidate imported yet.</td></tr>`}</tbody></table>
  <h2>Kharosthi Review Invitations</h2>
  <table><thead><tr><th>#</th><th>Reviewer role</th><th>Status</th><th>Delivery</th><th>Contact</th><th>Requested decision</th></tr></thead><tbody>${invitationRows || `<tr><td colspan="6">No review invitations prepared yet.</td></tr>`}</tbody></table>
  <footer>Current verdict: ${esc(progress.achievement || "UNVERIFIED")} / CONTROLLED_NO_GO · governedProductionGo=false.</footer>
</body>
</html>
`;

const out = join(root, "release/LIPI_REVIVAL_QUEUE.html");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`rendered ${out}`);
