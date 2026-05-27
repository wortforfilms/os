import type { LipiCharacterRecord } from "../types/character";

export const tokenAnchors: readonly LipiCharacterRecord[] = Object.freeze([
  { id: "brahmi-a", scriptId: "brahmi", token: "a", glyph: "𑀅", unicode: "U+11005", phoneticValue: "a", ipa: "ə", transliteration: "a", category: "VOWEL", anchorStatus: "SEEDED" },
  { id: "brahmi-ka", scriptId: "brahmi", token: "ka", glyph: "𑀓", unicode: "U+11013", phoneticValue: "ka", ipa: "kə", transliteration: "ka", category: "CONSONANT", anchorStatus: "SEEDED" },
  { id: "kharosthi-a", scriptId: "kharosthi", token: "a", glyph: "𐨀", unicode: "U+10A00", phoneticValue: "a", ipa: "ə", transliteration: "a", category: "VOWEL", anchorStatus: "SEEDED" },
  { id: "siddham-a", scriptId: "siddham", token: "a", glyph: "𑖀", unicode: "U+11580", phoneticValue: "a", ipa: "ə", transliteration: "a", category: "VOWEL", anchorStatus: "SEEDED" },
]);
