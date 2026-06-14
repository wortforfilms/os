/*
 * @maataa/lipi-runtime — bind phonetic (IPA) values to shapeshifter tokens.
 *
 * Realizes the Lipi chain step  ipa >> number >> shape  by joining the cross-script
 * shapeshifter tokens (from the Unicode authority) to the project's REAL in-repo
 * phonetic authority: phonetics/ipa-map + phonetics/pronunciation-rules.
 *
 * PHKD — the hard rule here:
 *  - IPA is a phonetic MEANING. We never invent it. A token gets an IPA value ONLY
 *    if it is present in the seeded in-repo authority (ipaMap). Every other token is
 *    UNKNOWN and fail-closed — not guessed.
 *  - Seeded values carry their review status (e.g. NEEDS_NATIVE_REVIEW). No value is
 *    presented as certified. CONTROLLED_NO_GO.
 */
import { ipaMap } from "./phonetics/ipa-map.ts";
import { pronunciationRules } from "./phonetics/pronunciation-rules.ts";
import { buildShiftIndex, shiftSets } from "./shapeshifter.ts";

export type BindStatus = "SEEDED_UNREVIEWED" | "NEEDS_NATIVE_REVIEW" | "UNKNOWN";

export interface PhoneticBinding {
  token: string;          // the shapeshifter token (e.g. "KA"), uppercase
  normalized: string;     // lowercased key used against the authority (e.g. "ka")
  ipa: string | null;     // from the seeded authority, or null (UNKNOWN — never invented)
  status: BindStatus;
  source: string | null;  // which in-repo authority supplied the value
}

const IPA: Record<string, string> = ipaMap as Record<string, string>;
const ruleStatusFor = (norm: string): string | null => {
  const r = pronunciationRules.find((x) => x.transliteration === norm);
  return r ? r.status : null;
};

/** Bind ONE token to the real phonetic authority. Fail-closed: unseeded → UNKNOWN. */
export function bindToken(token: string): PhoneticBinding {
  const norm = String(token).toLowerCase();
  if (Object.prototype.hasOwnProperty.call(IPA, norm)) {
    const ruleStatus = ruleStatusFor(norm);
    return {
      token: String(token).toUpperCase(),
      normalized: norm,
      ipa: IPA[norm],
      status: (ruleStatus as BindStatus) ?? "SEEDED_UNREVIEWED",
      source: ruleStatus ? "lipi-runtime/phonetics/pronunciation-rules" : "lipi-runtime/phonetics/ipa-map",
    };
  }
  return { token: String(token).toUpperCase(), normalized: norm, ipa: null, status: "UNKNOWN", source: null };
}

export interface PhoneticCoverage {
  schema: "maataa.lipi.phonetic-binding.v1";
  totalShiftTokens: number;
  seeded: number;           // tokens with a real IPA from the authority
  unknown: number;          // tokens left UNKNOWN (honest gap)
  bindings: PhoneticBinding[];
  authority: { ipaMapEntries: number; pronunciationRules: number };
  governedProductionGo: false;
  status: "CONTROLLED_NO_GO";
  note: string;
}

/** Bind every cross-script shapeshifter token. Builds the shift index from `path`. */
export function bindShiftTokens(path: string, minScripts = 2): PhoneticCoverage {
  buildShiftIndex(path);
  const tokens = shiftSets(minScripts).map((s) => s.token);
  const bindings = tokens.map(bindToken);
  const seeded = bindings.filter((b) => b.ipa !== null).length;
  return {
    schema: "maataa.lipi.phonetic-binding.v1",
    totalShiftTokens: tokens.length,
    seeded,
    unknown: tokens.length - seeded,
    bindings,
    authority: { ipaMapEntries: Object.keys(IPA).length, pronunciationRules: pronunciationRules.length },
    governedProductionGo: false,
    status: "CONTROLLED_NO_GO",
    note:
      "IPA values come only from the seeded in-repo authority; unseeded tokens are UNKNOWN, never invented. " +
      "Seeded values are review-pending, not certified. Broadening coverage requires real seeded anchors " +
      "(local teacher / evidence bundle) or an external ISO 15919 / IPA dataset ingested with provenance.",
  };
}
