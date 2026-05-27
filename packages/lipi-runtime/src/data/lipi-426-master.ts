import type { LipiScriptRecord } from "../types/script";

const canonicalScripts: LipiScriptRecord[] = [
  {
    id: "brahmi",
    isoCode: "Brah",
    name: "Brahmi",
    nativeName: "𑀩𑁆𑀭𑀸𑀳𑁆𑀫𑀻",
    direction: "LTR",
    family: "Brahmi",
    wave: "WAVE_1_CLASSICAL",
    status: "HISTORICAL",
    unicodeRange: "U+11000-U+1107F",
    region: "South Asia",
    purpose: "Classical inscription and manuscript study",
    oldestProof: "Requires local inscription evidence bundle before certification",
  },
  {
    id: "kharosthi",
    isoCode: "Khar",
    name: "Kharosthi",
    nativeName: "𐨑𐨪𐨆𐨯𐨠𐨁",
    direction: "RTL",
    family: "Kharosthi",
    wave: "WAVE_1_CLASSICAL",
    status: "HISTORICAL",
    unicodeRange: "U+10A00-U+10A5F",
    region: "Gandhara",
    purpose: "Classical manuscript and coin legend study",
    oldestProof: "Requires local Gandhari evidence bundle before certification",
  },
  {
    id: "siddham",
    isoCode: "Sidd",
    name: "Siddham",
    nativeName: "𑖭𑖰𑖟𑖿𑖠𑖽",
    direction: "LTR",
    family: "Brahmi",
    wave: "WAVE_1_CLASSICAL",
    status: "HISTORICAL",
    unicodeRange: "U+11580-U+115FF",
    region: "North India and East Asia",
    purpose: "Mantra, manuscript, and pedagogical preservation",
    oldestProof: "Requires local manuscript evidence bundle before certification",
  },
  { id: "sharada", isoCode: "Shrd", name: "Sharada", nativeName: "𑆯𑆳𑆫𑆢𑆳", direction: "LTR", family: "Brahmi", wave: "WAVE_2_REGIONAL", status: "HISTORICAL", unicodeRange: "U+11180-U+111DF", region: "Kashmir" },
  { id: "landa", isoCode: "Lana", name: "Landa", direction: "LTR", family: "Brahmi", wave: "WAVE_3_COMMERCIAL", status: "HISTORICAL", region: "Punjab and Sindh" },
  { id: "kaithi", isoCode: "Kthi", name: "Kaithi", nativeName: "𑂍𑂶𑂟𑂲", direction: "LTR", family: "Brahmi", wave: "WAVE_3_COMMERCIAL", status: "HISTORICAL", unicodeRange: "U+11080-U+110CF", region: "North India" },
  { id: "mahajani", isoCode: "Mahj", name: "Mahajani", nativeName: "𑅬𑅱𑅟𑅠𑅳𑅧", direction: "LTR", family: "Brahmi", wave: "WAVE_3_COMMERCIAL", status: "HISTORICAL", unicodeRange: "U+11150-U+1117F", region: "North India" },
  { id: "devanagari", isoCode: "Deva", name: "Devanagari", nativeName: "देवनागरी", direction: "LTR", family: "Brahmi", wave: "WAVE_2_REGIONAL", status: "ACTIVE", unicodeRange: "U+0900-U+097F", region: "India and Nepal" },
  { id: "gurmukhi", isoCode: "Guru", name: "Gurmukhi", nativeName: "ਗੁਰਮੁਖੀ", direction: "LTR", family: "Brahmi", wave: "WAVE_2_REGIONAL", status: "ACTIVE", unicodeRange: "U+0A00-U+0A7F", region: "Punjab" },
  { id: "shahmukhi", isoCode: "Arab", name: "Shahmukhi", nativeName: "شاہ مکھی", direction: "RTL", family: "Perso-Arabic", wave: "WAVE_2_REGIONAL", status: "ACTIVE", unicodeRange: "U+0600-U+06FF", region: "Punjab" },
  { id: "tamil", isoCode: "Taml", name: "Tamil", nativeName: "தமிழ்", direction: "LTR", family: "Brahmi", wave: "WAVE_2_REGIONAL", status: "ACTIVE", unicodeRange: "U+0B80-U+0BFF", region: "Tamilakam" },
  { id: "bengali", isoCode: "Beng", name: "Bengali", nativeName: "বাংলা", direction: "LTR", family: "Brahmi", wave: "WAVE_2_REGIONAL", status: "ACTIVE", unicodeRange: "U+0980-U+09FF", region: "Bengal" },
];

const extensionScripts: LipiScriptRecord[] = Array.from({ length: 426 - canonicalScripts.length }, (_, index) => {
  const ordinal = index + canonicalScripts.length + 1;
  return {
    id: `lipi-extension-${ordinal.toString().padStart(3, "0")}`,
    isoCode: `X${ordinal.toString(36).toUpperCase().padStart(3, "0")}`,
    name: `Lipi Evidence Slot ${ordinal}`,
    direction: "MIXED",
    family: "Evidence pending",
    wave: "EXTENSION",
    status: "BLOCKED",
    region: "Local evidence matrix",
    purpose: "Reserved for verified script ingestion after source proof is attached",
    oldestProof: "BLOCKED: missing authoritative local source bundle",
  };
});

export const lipi426Master: readonly LipiScriptRecord[] = Object.freeze([...canonicalScripts, ...extensionScripts]);
export const LIPI_426_EXPECTED_COUNT = 426;
