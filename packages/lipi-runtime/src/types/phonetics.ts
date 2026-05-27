export type LipiSoundClass = "VOWEL" | "PLOSIVE" | "NASAL" | "FRICATIVE" | "APPROXIMANT" | "SIBILANT" | "OTHER";

export interface LipiPhoneticRule {
  id: string;
  scriptId: string;
  soundClass: LipiSoundClass;
  ipa: string;
  transliteration: string;
  rule: string;
  status: "SEEDED" | "NEEDS_NATIVE_REVIEW" | "BLOCKED";
}
