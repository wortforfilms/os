/*
 * @maataa/lipi-runtime — Devanagari → IPA (base aksharas).
 *
 * Maps Devanagari letters (from the local Unicode authority) to their standard
 * citation-form IPA, extending the repo's existing seeded phonetic model
 * (phonetics/pronunciation-rules, which already seeds ka→kə as NEEDS_NATIVE_REVIEW).
 *
 * PROVENANCE / PHKD:
 *  - Values are the STANDARD published Devanagari (Hindi citation-form) phonemic
 *    values per ISO 15919 and standard Devanagari phonology. They are NOT invented
 *    and NOT a per-language surface realisation.
 *  - EVERY entry is status "NEEDS_NATIVE_REVIEW" — review-pending, never certified.
 *  - Letters with no entry in the cited base table return UNKNOWN (fail-closed),
 *    never a guessed value. Consonant values include the inherent vowel ə (repo
 *    convention: ka→kə). Schwa-deletion / contextual realisation is NOT modelled.
 *  - CONTROLLED_NO_GO.
 */
import { listByRange } from "./unicode-data.ts";
import { letterToken } from "./shapeshifter.ts";

export const DEVANAGARI_IPA_PROVENANCE = {
  standard: "ISO 15919:2001 + standard Devanagari (Hindi) phonemic values",
  reviewStatus: "NEEDS_NATIVE_REVIEW",
  caveats: [
    "citation form, language-independent base; not a per-language surface realisation",
    "consonants carry the inherent vowel ə; schwa-deletion not modelled",
    "nukta/borrowed letters included with their standard borrowed-phoneme values",
  ],
} as const;

// token (Unicode LETTER token, UPPERCASE) -> { ipa, soundClass }
// Citation-form values. Review-pending. Unlisted Devanagari letters -> UNKNOWN.
const BASE: Record<string, { ipa: string; soundClass: string }> = {
  // independent vowels
  A: { ipa: "ə", soundClass: "VOWEL" }, AA: { ipa: "aː", soundClass: "VOWEL" },
  I: { ipa: "i", soundClass: "VOWEL" }, II: { ipa: "iː", soundClass: "VOWEL" },
  U: { ipa: "u", soundClass: "VOWEL" }, UU: { ipa: "uː", soundClass: "VOWEL" },
  "VOCALIC R": { ipa: "r̩", soundClass: "VOWEL" }, "VOCALIC RR": { ipa: "r̩ː", soundClass: "VOWEL" },
  "VOCALIC L": { ipa: "l̩", soundClass: "VOWEL" }, "VOCALIC LL": { ipa: "l̩ː", soundClass: "VOWEL" },
  E: { ipa: "eː", soundClass: "VOWEL" }, AI: { ipa: "ɛː", soundClass: "VOWEL" },
  O: { ipa: "oː", soundClass: "VOWEL" }, AU: { ipa: "ɔː", soundClass: "VOWEL" },
  // velar
  KA: { ipa: "kə", soundClass: "PLOSIVE" }, KHA: { ipa: "kʰə", soundClass: "PLOSIVE" },
  GA: { ipa: "ɡə", soundClass: "PLOSIVE" }, GHA: { ipa: "ɡʱə", soundClass: "PLOSIVE" },
  NGA: { ipa: "ŋə", soundClass: "NASAL" },
  // palatal
  CA: { ipa: "t͡ʃə", soundClass: "AFFRICATE" }, CHA: { ipa: "t͡ʃʰə", soundClass: "AFFRICATE" },
  JA: { ipa: "d͡ʒə", soundClass: "AFFRICATE" }, JHA: { ipa: "d͡ʒʱə", soundClass: "AFFRICATE" },
  NYA: { ipa: "ɲə", soundClass: "NASAL" },
  // retroflex
  TTA: { ipa: "ʈə", soundClass: "PLOSIVE" }, TTHA: { ipa: "ʈʰə", soundClass: "PLOSIVE" },
  DDA: { ipa: "ɖə", soundClass: "PLOSIVE" }, DDHA: { ipa: "ɖʱə", soundClass: "PLOSIVE" },
  NNA: { ipa: "ɳə", soundClass: "NASAL" },
  // dental
  TA: { ipa: "t̪ə", soundClass: "PLOSIVE" }, THA: { ipa: "t̪ʰə", soundClass: "PLOSIVE" },
  DA: { ipa: "d̪ə", soundClass: "PLOSIVE" }, DHA: { ipa: "d̪ʱə", soundClass: "PLOSIVE" },
  NA: { ipa: "nə", soundClass: "NASAL" },
  // labial
  PA: { ipa: "pə", soundClass: "PLOSIVE" }, PHA: { ipa: "pʰə", soundClass: "PLOSIVE" },
  BA: { ipa: "bə", soundClass: "PLOSIVE" }, BHA: { ipa: "bʱə", soundClass: "PLOSIVE" },
  MA: { ipa: "mə", soundClass: "NASAL" },
  // approximants / sibilants / glottal
  YA: { ipa: "jə", soundClass: "APPROXIMANT" }, RA: { ipa: "rə", soundClass: "APPROXIMANT" },
  LA: { ipa: "lə", soundClass: "APPROXIMANT" }, LLA: { ipa: "ɭə", soundClass: "APPROXIMANT" },
  VA: { ipa: "ʋə", soundClass: "APPROXIMANT" },
  SHA: { ipa: "ʃə", soundClass: "SIBILANT" }, SSA: { ipa: "ʂə", soundClass: "SIBILANT" },
  SA: { ipa: "sə", soundClass: "SIBILANT" }, HA: { ipa: "ɦə", soundClass: "FRICATIVE" },
  // nukta / borrowed
  QA: { ipa: "qə", soundClass: "PLOSIVE" }, KHHA: { ipa: "xə", soundClass: "FRICATIVE" },
  GHHA: { ipa: "ɣə", soundClass: "FRICATIVE" }, ZA: { ipa: "zə", soundClass: "SIBILANT" },
  DDDHA: { ipa: "ɽə", soundClass: "FLAP" }, RHA: { ipa: "ɽʱə", soundClass: "FLAP" },
  FA: { ipa: "fə", soundClass: "FRICATIVE" }, YYA: { ipa: "jə", soundClass: "APPROXIMANT" },
};

const DEV_START = 0x0900, DEV_END = 0x097f;

export interface DevanagariIpaRecord {
  codepoint: number; hex: string; char: string; name: string; token: string;
  ipa: string | null; soundClass: string | null;
  status: "NEEDS_NATIVE_REVIEW" | "UNKNOWN";
  source: string | null;
}

const toHex = (n: number) => n.toString(16).toUpperCase().padStart(4, "0");

/** Map ONE Devanagari LETTER record to IPA. Fail-closed UNKNOWN if not in the cited base table. */
function toRecord(r: { codepoint: number; name: string }): DevanagariIpaRecord | null {
  const token = letterToken(r.name);
  if (!token) return null; // only LETTERs carry a base phonetic value here
  const base = BASE[token];
  return {
    codepoint: r.codepoint, hex: toHex(r.codepoint), char: String.fromCodePoint(r.codepoint),
    name: r.name, token,
    ipa: base ? base.ipa : null,
    soundClass: base ? base.soundClass : null,
    status: base ? "NEEDS_NATIVE_REVIEW" : "UNKNOWN",
    source: base ? "devanagari-ipa.BASE (ISO 15919 + std Devanagari, review-pending)" : null,
  };
}

let RECORDS: DevanagariIpaRecord[] = [];
let BY_CP = new Map<number, DevanagariIpaRecord>();
let LOADED = false;
export function resetDevanagariIpa(): void { RECORDS = []; BY_CP = new Map(); LOADED = false; }

/** Build the Devanagari→IPA table by joining the loaded UCD range to the cited base table. */
export function buildDevanagariIpa(): { letters: number; mapped: number; unknown: number } {
  const recs: DevanagariIpaRecord[] = [];
  for (const r of listByRange(DEV_START, DEV_END)) {
    const rec = toRecord(r);
    if (rec) recs.push(rec);
  }
  RECORDS = recs;
  BY_CP = new Map(recs.map((x) => [x.codepoint, x]));
  LOADED = true;
  const mapped = recs.filter((x) => x.ipa !== null).length;
  return { letters: recs.length, mapped, unknown: recs.length - mapped };
}

function ensure(): void { if (!LOADED) throw new Error("devanagari-ipa: not built — loadUnicodeData(...) then buildDevanagariIpa() (fail-closed)"); }

/** Devanagari char or codepoint → IPA record. UNKNOWN (fail-closed) if not a mapped letter. */
export function devanagariToIpa(input: string | number): DevanagariIpaRecord | null {
  ensure();
  const cp = typeof input === "number" ? input : input.codePointAt(0)!;
  return BY_CP.get(cp) ?? null;
}

export interface DevanagariIpaCoverage {
  schema: "maataa.lipi.devanagari-ipa.v1";
  range: string; letters: number; mapped: number; unknown: number;
  provenance: typeof DEVANAGARI_IPA_PROVENANCE;
  records: DevanagariIpaRecord[];
  governedProductionGo: false; status: "CONTROLLED_NO_GO";
}

export function devanagariIpaCoverage(): DevanagariIpaCoverage {
  ensure();
  const mapped = RECORDS.filter((x) => x.ipa !== null).length;
  return {
    schema: "maataa.lipi.devanagari-ipa.v1",
    range: `${toHex(DEV_START)}..${toHex(DEV_END)}`,
    letters: RECORDS.length, mapped, unknown: RECORDS.length - mapped,
    provenance: DEVANAGARI_IPA_PROVENANCE,
    records: RECORDS,
    governedProductionGo: false, status: "CONTROLLED_NO_GO",
  };
}
