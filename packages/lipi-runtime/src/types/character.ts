export type LipiCharacterCategory = "VOWEL" | "CONSONANT" | "MARK" | "NUMERAL" | "SIGN" | "LIGATURE";
export type LipiAnchorStatus = "ANCHOR_VERIFIED" | "SEEDED" | "NEEDS_EVIDENCE" | "BLOCKED";

export interface LipiCharacterRecord {
  id: string;
  scriptId: string;
  token: string;
  glyph: string;
  unicode?: string;
  phoneticValue?: string;
  ipa?: string;
  transliteration?: string;
  category: LipiCharacterCategory;
  anchorStatus: LipiAnchorStatus;
}
