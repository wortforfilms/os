import type { LipiPhoneticRule } from "../types/phonetics";

export const pronunciationRules: readonly LipiPhoneticRule[] = Object.freeze([
  { id: "brahmi-basic-a", scriptId: "brahmi", soundClass: "VOWEL", ipa: "ə", transliteration: "a", rule: "Use local teacher review before marking pronunciation verified.", status: "NEEDS_NATIVE_REVIEW" },
  { id: "brahmi-basic-ka", scriptId: "brahmi", soundClass: "PLOSIVE", ipa: "kə", transliteration: "ka", rule: "Unaspirated velar stop plus inherent vowel.", status: "NEEDS_NATIVE_REVIEW" },
]);
