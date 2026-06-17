#!/usr/bin/env node
/*
 * Imports source-backed Panini teaching examples into the Lipi corpus ledger.
 *
 * Honest boundary:
 * - The 15 sutra_teaching rows contain actual Sanskrit text and can become
 *   CONTROLLED_NO_GO corpus candidates with hashes and provenance.
 * - The 3,944 Ashtadhyayi "stubs" are metadata-only placeholders in the
 *   Hemant source file. They are recorded as candidates, but are not imported
 *   as texts until real source text is aligned and hashed.
 *
 * Run:
 *   node scripts/import-panini-corpus-texts.mjs
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const defaultTeachingPath = "/Volumes/LaCie/pprm/hemant-samwat/apps/panini-engine/panini-teaching-complete.json";
const defaultPdfPath = "/Users/vesahe/Downloads/2015.22683.The-Ashtadhyayi-Of-Panini_text.pdf";
const teachingPath = process.env.PANINI_TEACHING_JSON || defaultTeachingPath;
const pdfPath = process.env.PANINI_SOURCE_PDF || defaultPdfPath;
const sourceUrl = "https://archive.org/details/in.ernet.dli.2015.22683";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sha256File = (path) => sha256(readFileSync(path));
const normalizeText = (value) => String(value || "").normalize("NFC").trim().replace(/\s+/g, " ");
const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};

if (!existsSync(teachingPath)) throw new Error(`missing Panini teaching JSON: ${teachingPath}`);
if (!existsSync(pdfPath)) throw new Error(`missing Panini source PDF: ${pdfPath}`);

const teaching = readJson(teachingPath);
const sutras = teaching.sutra_teaching || [];
const stubs = teaching.ashtadhyayi_stubs || {};
const pdfHash = sha256File(pdfPath);
const teachingHash = sha256File(teachingPath);
const generatedAt = new Date().toISOString();

const sourceProofs = [
  {
    sourceId: "panini-ashtadhyayi-pdf-2015-22683",
    title: "The Ashtadhyayi Of Panini",
    author: "Panini",
    sourceUrl,
    localPath: pdfPath,
    sha256: pdfHash,
    observedPages: 292,
    note: "User-supplied PDF source edition. Text extraction is OCR-noisy, so imported rows remain review-pending until aligned against the source.",
  },
  {
    sourceId: "hemant-panini-teaching-complete",
    title: "Hemant Panini Teaching Completion Dataset",
    localPath: teachingPath,
    sha256: teachingHash,
    note: "Contains 15 real sutra teaching examples and a metadata-only declaration of 3,944 missing-source stubs.",
  },
];

const imported = sutras.map((s) => {
  const text = normalizeText(s.sa);
  const num = String(s.num || s.id || "unknown");
  const idNum = num.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    id: `panini-ashtadhyayi-${idNum}`,
    scriptId: "devanagari",
    title: `Ashtadhyayi ${num}`,
    language: "sa",
    text,
    sourceUrl,
    license: "SOURCE_RIGHTS_REVIEW_REQUIRED",
    provenance: [
      {
        sourceId: "hemant-panini-teaching-complete",
        url: `local:${teachingPath}`,
        note: `sutra_teaching row ${s.id || num}; not independently certified`,
      },
      {
        sourceId: "panini-ashtadhyayi-pdf-2015-22683",
        url: sourceUrl,
        note: "source edition supplied for alignment and review",
      },
    ],
    reviewState: "CONTROLLED_NO_GO",
    textHash: `sha256:${sha256(text)}`,
    panini: {
      number: num,
      category: s.category || "UNKNOWN",
      gloss: s.en || "UNKNOWN",
      example: s.example || "UNKNOWN",
    },
  };
});

const corpusPath = join(root, "data/lipi-corpus-texts.json");
const existing = existsSync(corpusPath) ? readJson(corpusPath) : { texts: [] };
const nonPaniniTexts = (existing.texts || []).filter((t) => !String(t.id || "").startsWith("panini-ashtadhyayi-"));
const corpus = {
  schema: "maataa.lipi-corpus.text.v1",
  generatedAt,
  reviewState: "CONTROLLED_NO_GO",
  governedProductionGo: false,
  honesty: "Corpus entries are evidence-backed candidates. They count as raw corpus texts, but not as certified corpus texts until reviewState is CERTIFIED.",
  sourceProofs,
  texts: [...nonPaniniTexts, ...imported].sort((a, b) => String(a.id).localeCompare(String(b.id))),
};
writeJson(corpusPath, corpus);

const evidence = {
  schema: "maataa.panini-corpus-import.v1",
  generatedAt,
  reviewState: "CONTROLLED_NO_GO",
  governedProductionGo: false,
  sources: sourceProofs,
  importedTextRecords: imported.length,
  importedReviewState: "CONTROLLED_NO_GO",
  certifiedTextRecords: 0,
  declaredStubCandidates: Number(stubs.total_declared || 0),
  stubSourceStatus: stubs.source_status || "UNKNOWN",
  stubPolicy: stubs.stub_policy || "UNKNOWN",
  notImportedStubCandidates: Number(stubs.total_declared || 0),
  notImportedReason: "The 3,944 Ashtadhyayi stubs are metadata-only placeholders; they have no per-sutra source text or textHash yet.",
  outputs: {
    corpus: "data/lipi-corpus-texts.json",
    evidence: "release/evidence/panini-corpus-import.json",
  },
};
writeJson(join(root, "release/evidence/panini-corpus-import.json"), evidence);

console.log(`panini-corpus: imported=${imported.length} reviewState=CONTROLLED_NO_GO certified=0`);
console.log(`panini-corpus: stubsNotImported=${evidence.notImportedStubCandidates} reason=${evidence.notImportedReason}`);
