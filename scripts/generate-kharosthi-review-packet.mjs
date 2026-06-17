#!/usr/bin/env node
/*
 * Builds the Kharosthi review packet:
 * - one Kharosthi-linked corpus candidate
 * - review invitations for specialist certification
 * - an empty certification ledger, so no text becomes CERTIFIED by accident
 *
 * Run:
 *   node scripts/generate-kharosthi-review-packet.mjs
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const generatedAt = new Date().toISOString();
const sha256 = (value) => createHash("sha256").update(String(value)).digest("hex");
const sha256File = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const readJson = (path, fallback) => (existsSync(join(root, path)) ? JSON.parse(readFileSync(join(root, path), "utf8")) : fallback);
const writeJson = (path, value) => {
  const out = join(root, path);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(value, null, 2)}\n`);
};
const indianEpigraphyPath = process.env.INDIAN_EPIGRAPHY_PDF || "/Users/vesahe/Downloads/Indian Epigraphy.pdf";
const indianEpigraphyPresent = existsSync(indianEpigraphyPath);
const indianEpigraphyProof = {
  sourceId: "indian-epigraphy-salomon-1998",
  title: "Indian Epigraphy: A Guide to the Study of Inscriptions in Sanskrit, Prakrit, and Other Indo-Aryan Languages",
  author: "Richard Salomon",
  publisher: "Oxford University Press",
  year: 1998,
  localPath: indianEpigraphyPath,
  localFilePresent: indianEpigraphyPresent,
  sha256: indianEpigraphyPresent ? sha256File(indianEpigraphyPath) : "LOCAL_FILE_NOT_PRESENT",
  observedPages: 401,
  extractedHits: [
    {
      page: 65,
      term: "Kharosthi",
      note: "Section 2.3 introduces the Kharosthi script and cites standard Kharosthi inscription references.",
    },
    {
      page: 67,
      term: "Wardak",
      note: "Geographical range discussion mentions specimens from Kabul River sites as far west as Wardak/Khawat.",
    },
    {
      page: 209,
      term: "decipherment",
      note: "Table of contents marks section 6.2.2 on decipherment of the Kharosthi script.",
    },
  ],
  note: "Reviewer-support source for Kharosthi epigraphy context. It strengthens the review packet but does not certify the Wardak line by itself.",
};

const candidateText = {
  id: "kharosthi-wardak-vase-line-4",
  scriptId: "kharosthi",
  title: "Wardak Vase inscription line 4",
  language: "pgd",
  text: "𐨀𐨅𐨮 𐨬𐨁𐨱𐨪 𐨀𐨕𐨪𐨩𐨞 𐨨𐨱𐨯𐨎𐨓𐨁𐨒𐨞 𐨤𐨪𐨁𐨒𐨿𐨪𐨱",
  sourceUrl: "https://en.wikipedia.org/wiki/Wardak_Vase",
  license: "CC-BY-SA-4.0_TRANSCRIPTION_SOURCE_REVIEW_REQUIRED",
  provenance: [
    {
      sourceId: "wardak-vase-wikipedia",
      url: "https://en.wikipedia.org/wiki/Wardak_Vase",
      note: "Secondary source table gives Kharosthi original and translation for Wardak Vase line 4.",
    },
    {
      sourceId: "gandhari-catalog",
      url: "https://gandhari.org/catalog",
      note: "Catalog of Gandhari Texts by Stefan Baums and Andrew Glass; Wardak Vase line requires specialist alignment against the catalog record before certification.",
    },
    {
      sourceId: "unicode-kharoshthi-chart",
      url: "https://www.unicode.org/charts/PDF/U10A00.pdf",
      note: "Unicode Kharoshthi code chart confirms script encoding and character repertoire.",
    },
    {
      sourceId: "indian-epigraphy-salomon-1998",
      url: `local:${indianEpigraphyPath}`,
      note: "Indian Epigraphy provides scholarly context for Kharosthi geography/history and mentions Wardak/Khawat in the geographical range discussion; specialist alignment still required.",
    },
  ],
  reviewState: "CONTROLLED_NO_GO",
  certificationTarget: true,
  certificationStatus: "AWAITING_REVIEW",
  reviewInvitationIds: [
    "invite-kharosthi-epigraphy-wardak-vase",
    "invite-gandhari-philology-wardak-vase",
    "invite-kharosthi-source-rights-wardak-vase",
  ],
  textHash: "",
  kharosthi: {
    object: "Wardak Vase",
    line: "4",
    translation: "This monastery is in the possession of Mahasanghika teachers.",
    certificationNeed: "Verify the Kharosthi glyph string, line segmentation, language tag, translation alignment, and source rights before any CERTIFIED claim.",
  },
};
candidateText.textHash = `sha256:${sha256(candidateText.text.normalize("NFC").trim().replace(/\s+/g, " "))}`;

const corpus = readJson("data/lipi-corpus-texts.json", {
  schema: "maataa.lipi-corpus.text.v1",
  generatedAt,
  reviewState: "CONTROLLED_NO_GO",
  governedProductionGo: false,
  honesty: "Corpus entries are evidence-backed candidates. They count as raw corpus texts, but not as certified corpus texts until reviewState is CERTIFIED.",
  sourceProofs: [],
  texts: [],
});

const sourceProof = {
  sourceId: "wardak-vase-kharosthi-source",
  title: "Wardak Vase inscription",
  sourceUrl: "https://en.wikipedia.org/wiki/Wardak_Vase",
  relatedCatalog: "https://gandhari.org/catalog",
  note: "Review-pending Kharosthi corpus candidate; secondary transcription must be checked against the Gandhari catalog / specialist source before certification.",
};

corpus.generatedAt = generatedAt;
corpus.sourceProofs = [
  ...(corpus.sourceProofs || []).filter((s) => ![sourceProof.sourceId, indianEpigraphyProof.sourceId].includes(s.sourceId)),
  sourceProof,
  indianEpigraphyProof,
];
corpus.texts = [...(corpus.texts || []).filter((t) => t.id !== candidateText.id), candidateText].sort((a, b) => String(a.id).localeCompare(String(b.id)));
writeJson("data/lipi-corpus-texts.json", corpus);
writeJson("release/evidence/indian-epigraphy-source-proof.json", {
  schema: "maataa.source-proof.pdf.v1",
  generatedAt,
  governedProductionGo: false,
  reviewState: "CONTROLLED_NO_GO",
  source: indianEpigraphyProof,
  usedFor: [
    "data/lipi-corpus-texts.json#kharosthi-wardak-vase-line-4",
    "data/lipi-review-invitations.json#invite-kharosthi-epigraphy-wardak-vase",
    "release/evidence/kharosthi-review-packet.json",
  ],
  certificationEffect: "NONE_BY_ITSELF",
});

const invitations = {
  schema: "maataa.lipi-review-invitations.v1",
  generatedAt,
  governedProductionGo: false,
  reviewState: "CONTROLLED_NO_GO",
  honesty: "Invitation records are ready-to-send review packets. They do not certify scripts or texts; only accepted certification decisions in data/lipi-review-certifications.json can do that.",
  subject: {
    scriptId: "kharosthi",
    candidateRecordId: "endangered-kharosthi",
    candidateTextId: candidateText.id,
  },
  invitations: [
    {
      id: "invite-kharosthi-epigraphy-wardak-vase",
      status: "READY_TO_SEND",
      deliveryStatus: "NOT_SENT_NO_CONTACT",
      reviewerRole: "Kharosthi / Gandhari epigraphy specialist",
      contact: "TO_BE_ASSIGNED",
      requestedDecision: "CERTIFY | REQUEST_CHANGES | REJECT",
      evidenceBundle: [
        "data/endangered-scripts-enriched.json#kharosthi",
        "data/lipi-corpus-texts.json#kharosthi-wardak-vase-line-4",
        "release/evidence/lipi-endangerment-dashboard.json#endangered-kharosthi",
        "release/evidence/indian-epigraphy-source-proof.json",
      ],
      message: "Please review the Kharosthi candidate and Wardak Vase line for glyph accuracy, line segmentation, transliteration/translation alignment, and whether the text can be certified for the revival corpus.",
    },
    {
      id: "invite-gandhari-philology-wardak-vase",
      status: "READY_TO_SEND",
      deliveryStatus: "NOT_SENT_NO_CONTACT",
      reviewerRole: "Gandhari / Prakrit philology reviewer",
      contact: "TO_BE_ASSIGNED",
      requestedDecision: "CERTIFY | REQUEST_CHANGES | REJECT",
      evidenceBundle: [
        "data/lipi-corpus-texts.json#kharosthi-wardak-vase-line-4",
        "https://gandhari.org/catalog",
        "https://en.wikipedia.org/wiki/Wardak_Vase",
        "release/evidence/indian-epigraphy-source-proof.json",
      ],
      message: "Please verify the language tag, translation, and source alignment for the Wardak Vase Kharosthi line before any CERTIFIED corpus-text claim.",
    },
    {
      id: "invite-kharosthi-source-rights-wardak-vase",
      status: "READY_TO_SEND",
      deliveryStatus: "NOT_SENT_NO_CONTACT",
      reviewerRole: "Source provenance / rights reviewer",
      contact: "TO_BE_ASSIGNED",
      requestedDecision: "CERTIFY_SOURCE_RIGHTS | REQUEST_CHANGES | REJECT",
      evidenceBundle: [
        "data/lipi-corpus-texts.json#kharosthi-wardak-vase-line-4",
        "https://en.wikipedia.org/wiki/Wardak_Vase",
        "release/evidence/indian-epigraphy-source-proof.json",
      ],
      message: "Please confirm source URL, license/rights statement, and attribution requirements for carrying this transcription in the certified corpus.",
    },
  ],
};
writeJson("data/lipi-review-invitations.json", invitations);

const certifications = readJson("data/lipi-review-certifications.json", null) || {
  schema: "maataa.lipi-review-certifications.v1",
  generatedAt,
  governedProductionGo: false,
  honesty: "Empty by default. A corpus text is certified only after a named reviewer decision with evidenceHash and accepted status is recorded here.",
  certifications: [],
};
certifications.generatedAt = generatedAt;
certifications.pendingTargets = [
  {
    id: "pending-kharosthi-wardak-vase-line-4",
    scriptId: "kharosthi",
    candidateTextId: candidateText.id,
    requiredRoles: [
      "Kharosthi / Gandhari epigraphy specialist",
      "Gandhari / Prakrit philology reviewer",
      "Source provenance / rights reviewer",
    ],
    status: "AWAITING_REVIEW",
  },
];
writeJson("data/lipi-review-certifications.json", certifications);

const evidence = {
  schema: "maataa.kharosthi.review-packet.v1",
  generatedAt,
  governedProductionGo: false,
  reviewState: "CONTROLLED_NO_GO",
  scriptId: "kharosthi",
  candidateRecordId: "endangered-kharosthi",
  candidateTextId: candidateText.id,
  candidateTextHash: candidateText.textHash,
  indianEpigraphySourceProof: "release/evidence/indian-epigraphy-source-proof.json",
  indianEpigraphyPdfPresent: indianEpigraphyPresent,
  rawKharosthiCorpusCandidates: 1,
  certifiedKharosthiCorpusTexts: 0,
  reviewInvitationsReadyToSend: invitations.invitations.length,
  externalMessagesSent: 0,
  certificationStatus: "AWAITING_REVIEW",
  blockers: [
    "No reviewer contacts are assigned, so invitations are READY_TO_SEND but not externally delivered.",
    "No accepted certification decision exists in data/lipi-review-certifications.json.",
    "Kharosthi corpus text remains CONTROLLED_NO_GO until specialist review signs it.",
  ],
  outputs: {
    invitations: "data/lipi-review-invitations.json",
    certifications: "data/lipi-review-certifications.json",
    corpus: "data/lipi-corpus-texts.json",
  },
};
writeJson("release/evidence/kharosthi-review-packet.json", evidence);

console.log(`kharosthi-review: invitations=${invitations.invitations.length} rawText=1 certifiedText=0`);
