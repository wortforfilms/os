#!/usr/bin/env node
/*
 * Measures progress toward "Revive 50+ lipis & 1000+ texts by 2030" against the
 * operational definition (data/lipi-revival-definition.json). Honest + fail-closed:
 * a script counts as REVIVED only if it meets EVERY criterion with provenance.
 * Today that is 0 — the card stays UNVERIFIED. Writes a clear measured gap.
 *
 * Run: node scripts/generate-lipi-revival-progress.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const J = (p) => (existsSync(join(root, p)) ? JSON.parse(readFileSync(join(root, p), "utf8")) : null);

const def = J("data/lipi-revival-definition.json");
if (!def) throw new Error("missing data/lipi-revival-definition.json");
const enriched = J("data/endangered-scripts-enriched.json") || { scripts: [] };
const runtimeEv = J("packages/lipi-runtime/release/evidence/lipi-endangered-scripts.json") || { scripts: [] };
const corpus = J("data/lipi-corpus-texts.json") || { texts: [] }; // not yet created => 0 texts
const reviewInvitations = J("data/lipi-review-invitations.json") || { invitations: [] };
const reviewCertifications = J("data/lipi-review-certifications.json") || { certifications: [] };

const reviewStateById = new Map((runtimeEv.scripts || []).map((s) => [String(s.id).replace(/^endangered-/, ""), s.reviewState]));
const acceptedCertifiedTextIds = new Set(
  (reviewCertifications.certifications || [])
    .filter((c) => c.status === "ACCEPTED" && c.decision === "CERTIFY_TEXT" && c.evidenceHash)
    .map((c) => c.candidateTextId),
);
const isCertifiedText = (t) =>
  t.reviewState === "CERTIFIED" &&
  (t.provenance || []).length >= 1 &&
  acceptedCertifiedTextIds.has(t.id);

// Evaluate each enriched script against the 5 revived criteria.
let revived = 0;
const perCriterion = { "certified-review": 0, "verified-endonym": 0, "unicode-encoded": 0, "second-source": 0, "corpus-link": 0 };
const corpusByScript = new Map();
const certifiedCorpusByScript = new Map();
for (const t of corpus.texts || []) {
  corpusByScript.set(t.scriptId, (corpusByScript.get(t.scriptId) || 0) + 1);
  if (isCertifiedText(t)) certifiedCorpusByScript.set(t.scriptId, (certifiedCorpusByScript.get(t.scriptId) || 0) + 1);
}

for (const s of enriched.scripts || []) {
  const reviewState = reviewStateById.get(s.id) || "CONTROLLED_NO_GO";
  const c1 = reviewState === "CERTIFIED";
  const c2 = s.nativeName && s.nativeName !== "UNKNOWN" && (s.nativeNameProvenance || []).length >= 1;
  const c3 = s.unicode?.encoded === true && (s.unicode?.sampleCodepoints || []).length >= 1;
  const c4 = (s.provenance || []).length >= 2;
  const c5 = (certifiedCorpusByScript.get(s.id) || 0) >= 1;
  if (c1) perCriterion["certified-review"] += 1;
  if (c2) perCriterion["verified-endonym"] += 1;
  if (c3) perCriterion["unicode-encoded"] += 1;
  if (c4) perCriterion["second-source"] += 1;
  if (c5) perCriterion["corpus-link"] += 1;
  if (c1 && c2 && c3 && c4 && c5) revived += 1;
}

const corpusTexts = (corpus.texts || []).length;
const certifiedCorpusTexts = (corpus.texts || []).filter(isCertifiedText).length;
const achieved = revived >= def.targets.revivedScripts && certifiedCorpusTexts >= def.targets.corpusTexts;

const blockers = [];
if (revived < def.targets.revivedScripts) blockers.push(`revived scripts ${revived}/${def.targets.revivedScripts} (no script is CERTIFIED yet; all seeded records are CONTROLLED_NO_GO source-claims)`);
if (certifiedCorpusTexts < def.targets.corpusTexts) blockers.push(`certified corpus texts ${certifiedCorpusTexts}/${def.targets.corpusTexts} (${corpusTexts} raw corpus text${corpusTexts === 1 ? "" : "s"} are review-pending; certification still required)`);

const evidence = {
  schema: "maataa.lipi-revival.progress.v1",
  generatedAt: new Date().toISOString(),
  claim: "c-outcome-50-lipis-revived",
  definition: "data/lipi-revival-definition.json",
  reviewState: "CONTROLLED_NO_GO",
  governedProductionGo: false,
  achievement: achieved ? "ACHIEVED" : "UNVERIFIED",
  honesty: "Future 2030 commitment. Measured against the operational definition; a script is REVIVED only if it meets all five criteria. Not achieved — kept UNVERIFIED with the measured gap.",
  measured: {
    scriptsSeeded: (enriched.scripts || []).length,
    scriptsTowardTarget: `${(enriched.scripts || []).length}/${def.targets.revivedScripts}`,
    revivedScripts: revived,
    perCriterion,
    corpusTexts,
    certifiedCorpusTexts,
    rawCorpusLinks: [...corpusByScript.entries()].map(([scriptId, count]) => ({ scriptId, count })),
    certifiedCorpusLinks: [...certifiedCorpusByScript.entries()].map(([scriptId, count]) => ({ scriptId, count })),
    reviewInvitations: {
      total: (reviewInvitations.invitations || []).length,
      readyToSend: (reviewInvitations.invitations || []).filter((i) => i.status === "READY_TO_SEND").length,
      notSentNoContact: (reviewInvitations.invitations || []).filter((i) => i.deliveryStatus === "NOT_SENT_NO_CONTACT").length,
    },
    targets: def.targets,
  },
  blockers,
};

writeFileSync(join(root, "release/evidence/lipi-revival-progress.json"), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`lipi-revival: revivedScripts=${revived}/${def.targets.revivedScripts} certifiedTexts=${certifiedCorpusTexts}/${def.targets.corpusTexts} => ${achieved ? "ACHIEVED" : "UNVERIFIED (kept blocked)"}`);
for (const b of blockers) console.log(`  blocker: ${b}`);
