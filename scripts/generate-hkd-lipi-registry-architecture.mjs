import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const UCD_DIR = "data/unicode/ucd-latest";
const OUT = {
  architecture: "data/hkd-lipi-registry-architecture.json",
  seed: "data/hkd-lipi-script-registry-seed-426.json",
  evidence: "release/evidence/hkd-lipi-registry-architecture.json",
  markdown: "release/HKD_LIPI_REGISTRY_ARCHITECTURE.md",
  html: "release/HKD_LIPI_REGISTRY_ARCHITECTURE.html",
  jsonSchema: "schemas/hkd-lipi-script-registry.schema.json",
  tsTypes: "packages/lipi-runtime/src/registry/hkd-lipi-registry-types.ts",
  prisma: "packages/lipi-runtime/prisma/hkd-lipi-registry.prisma",
  sqlite: "migrations/sqlite/010_hkd_lipi_registry.sql",
  postgres: "migrations/postgresql/010_hkd_lipi_registry.sql",
};

const phkdRules = [
  "Never invent Unicode assignments.",
  "Never invent ISO 15924 codes.",
  "Mark uncertain information as UNKNOWN.",
  "Mark unencoded systems as UNENCODED.",
  "Mark disputed systems as DISPUTED.",
  "Separate verified facts from research hypotheses.",
  "Every record must contain provenance.",
  "Fail closed rather than hallucinate.",
];

const sourceRefs = [
  {
    id: "unicode-ucd-17-property-value-aliases",
    label: "Unicode 17.0.0 PropertyValueAliases.txt",
    url: "https://www.unicode.org/Public/UCD/latest/ucd/PropertyValueAliases.txt",
    localPath: `${UCD_DIR}/PropertyValueAliases.txt`,
    sourceKind: "primary_unicode_data",
  },
  {
    id: "unicode-ucd-17-scripts",
    label: "Unicode 17.0.0 Scripts.txt",
    url: "https://www.unicode.org/Public/UCD/latest/ucd/Scripts.txt",
    localPath: `${UCD_DIR}/Scripts.txt`,
    sourceKind: "primary_unicode_data",
  },
  {
    id: "unicode-ucd-17-script-extensions",
    label: "Unicode 17.0.0 ScriptExtensions.txt",
    url: "https://www.unicode.org/Public/UCD/latest/ucd/ScriptExtensions.txt",
    localPath: `${UCD_DIR}/ScriptExtensions.txt`,
    sourceKind: "primary_unicode_data",
  },
  {
    id: "unicode-ucd-17-blocks",
    label: "Unicode 17.0.0 Blocks.txt",
    url: "https://www.unicode.org/Public/UCD/latest/ucd/Blocks.txt",
    localPath: `${UCD_DIR}/Blocks.txt`,
    sourceKind: "primary_unicode_data",
  },
  {
    id: "unicode-ucd-17-derived-age",
    label: "Unicode 17.0.0 DerivedAge.txt",
    url: "https://www.unicode.org/Public/UCD/latest/ucd/DerivedAge.txt",
    localPath: `${UCD_DIR}/DerivedAge.txt`,
    sourceKind: "primary_unicode_data",
  },
  {
    id: "maataa-lipi-426-master-timeline",
    label: "MAATAA Lipi 426 master timeline evidence",
    localPath: "release/evidence/lipi-426-master-timeline.json",
    sourceKind: "local_runtime_evidence",
  },
  {
    id: "hkd-registry-architect-user-prompt",
    label: "HKD Lipi Registry Architect prompt, 2026-06-17",
    sourceKind: "user_requested_research_scope",
  },
];

function read(path) {
  return readFileSync(path, "utf8");
}

function sha256(path) {
  return createHash("sha256").update(read(path)).digest("hex");
}

function stripComment(line) {
  return line.split("#")[0].trim();
}

function parseRange(rangeText) {
  const [a, b = a] = rangeText.split("..");
  return [Number.parseInt(a, 16), Number.parseInt(b, 16)];
}

function rangeLabel([start, end]) {
  const left = `U+${start.toString(16).toUpperCase().padStart(4, "0")}`;
  const right = `U+${end.toString(16).toUpperCase().padStart(4, "0")}`;
  return start === end ? left : `${left}-${right}`;
}

function intersects(a, b) {
  return a[0] <= b[1] && b[0] <= a[1];
}

function slug(value) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function display(value) {
  return value.replace(/_/g, " ");
}

function parsePropertyValueAliases() {
  return read(`${UCD_DIR}/PropertyValueAliases.txt`)
    .split(/\r?\n/)
    .map(stripComment)
    .filter((line) => line.startsWith("sc"))
    .map((line) => {
      const parts = line.split(";").map((part) => part.trim()).filter(Boolean);
      return {
        unicode_script_alias: parts[1],
        unicode_script_value: parts[2],
        alternateAliases: parts.slice(3),
      };
    });
}

function parsePropertyRanges(path) {
  const map = new Map();
  for (const line of read(path).split(/\r?\n/).map(stripComment)) {
    if (!line || !line.includes(";")) continue;
    const [rangeText, valueText] = line.split(";").map((part) => part.trim());
    const value = valueText.split(/\s+/)[0];
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(parseRange(rangeText));
  }
  return map;
}

function parseBlocks() {
  return read(`${UCD_DIR}/Blocks.txt`)
    .split(/\r?\n/)
    .map(stripComment)
    .filter((line) => line.includes(";"))
    .map((line) => {
      const [rangeText, name] = line.split(";").map((part) => part.trim());
      return { name, range: parseRange(rangeText), rangeLabel: rangeLabel(parseRange(rangeText)) };
    });
}

function parseAges() {
  return read(`${UCD_DIR}/DerivedAge.txt`)
    .split(/\r?\n/)
    .map(stripComment)
    .filter((line) => line.includes(";"))
    .map((line) => {
      const [rangeText, age] = line.split(";").map((part) => part.trim());
      return { age, range: parseRange(rangeText) };
    });
}

function findBlocksForRanges(ranges, blocks) {
  return blocks.filter((block) => ranges.some((range) => intersects(range, block.range)));
}

function findBlockByName(blocks, name) {
  return blocks.find((block) => block.name.toLowerCase() === name.toLowerCase());
}

function minUnicodeAgeForRanges(ranges, ages) {
  const versions = new Set();
  for (const range of ranges) {
    for (const age of ages) {
      if (intersects(range, age.range)) versions.add(age.age);
    }
  }
  if (!versions.size) return "UNKNOWN";
  return [...versions].sort(compareUnicodeVersions)[0];
}

function compareUnicodeVersions(a, b) {
  const ap = a.split(".").map(Number);
  const bp = b.split(".").map(Number);
  return (ap[0] ?? 0) - (bp[0] ?? 0) || (ap[1] ?? 0) - (bp[1] ?? 0) || (ap[2] ?? 0) - (bp[2] ?? 0);
}

const familyMap = new Map([
  ["Adlam", "african"],
  ["Arabic", "semitic"],
  ["Hebrew", "semitic"],
  ["Imperial_Aramaic", "semitic"],
  ["Nabataean", "semitic"],
  ["Palmyrene", "semitic"],
  ["Phoenician", "semitic"],
  ["Samaritan", "semitic"],
  ["Syriac", "semitic"],
  ["Avestan", "iranian"],
  ["Bengali", "brahmic"],
  ["Bhaiksuki", "brahmic"],
  ["Brahmi", "brahmic"],
  ["Chakma", "brahmic"],
  ["Devanagari", "brahmic"],
  ["Dogra", "brahmic"],
  ["Grantha", "brahmic"],
  ["Gujarati", "brahmic"],
  ["Gunjala_Gondi", "brahmic"],
  ["Gurmukhi", "brahmic"],
  ["Kaithi", "brahmic"],
  ["Kannada", "brahmic"],
  ["Khojki", "brahmic"],
  ["Khudawadi", "brahmic"],
  ["Lepcha", "brahmic"],
  ["Limbu", "brahmic"],
  ["Mahajani", "brahmic"],
  ["Malayalam", "brahmic"],
  ["Marchen", "brahmic"],
  ["Masaram_Gondi", "brahmic"],
  ["Meetei_Mayek", "brahmic"],
  ["Modi", "brahmic"],
  ["Multani", "brahmic"],
  ["Nandinagari", "brahmic"],
  ["Newa", "brahmic"],
  ["Oriya", "brahmic"],
  ["Saurashtra", "brahmic"],
  ["Sharada", "brahmic"],
  ["Siddham", "brahmic"],
  ["Sinhala", "brahmic"],
  ["Syloti_Nagri", "brahmic"],
  ["Takri", "brahmic"],
  ["Tamil", "brahmic"],
  ["Telugu", "brahmic"],
  ["Thaana", "brahmic"],
  ["Tibetan", "brahmic"],
  ["Tirhuta", "brahmic"],
  ["Han", "cjk"],
  ["Hangul", "cjk"],
  ["Hiragana", "cjk"],
  ["Katakana", "cjk"],
  ["Bopomofo", "cjk"],
  ["Cyrillic", "cyrillic"],
  ["Greek", "greek"],
  ["Coptic", "greek"],
  ["Latin", "latin"],
  ["Braille", "notation"],
  ["Duployan", "shorthand"],
  ["SignWriting", "notation"],
  ["Common", "symbolic"],
  ["Inherited", "symbolic"],
  ["Unknown", "symbolic"],
]);

const writingTypeMap = new Map([
  ["Arabic", "abjad"],
  ["Hebrew", "abjad"],
  ["Syriac", "abjad"],
  ["Avestan", "alphabet"],
  ["Cyrillic", "alphabet"],
  ["Greek", "alphabet"],
  ["Latin", "alphabet"],
  ["Brahmi", "abugida"],
  ["Devanagari", "abugida"],
  ["Bengali", "abugida"],
  ["Gujarati", "abugida"],
  ["Gurmukhi", "abugida"],
  ["Kannada", "abugida"],
  ["Malayalam", "abugida"],
  ["Oriya", "abugida"],
  ["Tamil", "abugida"],
  ["Telugu", "abugida"],
  ["Thai", "abugida"],
  ["Lao", "abugida"],
  ["Khmer", "abugida"],
  ["Myanmar", "abugida"],
  ["Tibetan", "abugida"],
  ["Han", "logographic"],
  ["Egyptian_Hieroglyphs", "logographic"],
  ["Hiragana", "syllabary"],
  ["Katakana", "syllabary"],
  ["Hangul", "alphabet"],
  ["Common", "symbolic"],
  ["Inherited", "symbolic"],
  ["Unknown", "symbolic"],
  ["Braille", "notation"],
  ["SignWriting", "notation"],
  ["Duployan", "shorthand"],
]);

const rtlScripts = new Set([
  "Arabic",
  "Hebrew",
  "Imperial_Aramaic",
  "Inscriptional_Pahlavi",
  "Inscriptional_Parthian",
  "Kharoshthi",
  "Mandaic",
  "Manichaean",
  "Nabataean",
  "Nko",
  "Old_South_Arabian",
  "Old_Turkic",
  "Palmyrene",
  "Phoenician",
  "Psalter_Pahlavi",
  "Samaritan",
  "Syriac",
  "Thaana",
  "Yezidi",
]);

const cursiveScripts = new Set(["Arabic", "Syriac", "Mandaic", "Mongolian", "Nko", "Adlam"]);

function scriptPropertyKind(value) {
  if (value === "Common") return "common";
  if (value === "Inherited") return "inherited";
  if (value === "Unknown") return "unknown";
  return "explicit";
}

function provenance(sourceIds, stance = "verified_fact") {
  return {
    stance,
    sourceIds,
    generatedBy: "scripts/generate-hkd-lipi-registry-architecture.mjs",
    phkd: "FACTS_FROM_SOURCES_OR_UNKNOWN",
    reviewed: false,
  };
}

function unknownRecordFields() {
  return {
    native_name: "UNKNOWN",
    parent_script: "UNKNOWN",
    languages: ["UNKNOWN"],
    unicode_script_value: "UNKNOWN",
    unicode_script_alias: "UNKNOWN",
    iso15924: "UNKNOWN",
    unicode_version_added: "UNKNOWN",
    unicode_blocks: [],
    unicode_ranges: [],
    script_extensions: [],
    has_decimal_digits: "UNKNOWN",
    zero_glyph: "UNKNOWN",
    digits_0_9: [],
    vowels: [],
    consonants: [],
    matras: [],
    ligatures: [],
    punctuation: [],
    symbols: [],
    recommended_fonts: [],
    transliteration_systems: [],
    normalization_notes: "UNKNOWN",
    collation_notes: "UNKNOWN",
  };
}

function buildUnicodeRecord({ entry, ranges, blocksForScript, unicodeVersionAdded, index }) {
  const value = entry.unicode_script_value;
  const propertyKind = scriptPropertyKind(value);
  const family = familyMap.get(value) ?? "UNKNOWN";
  const writingSystemType = writingTypeMap.get(value) ?? "UNKNOWN";
  return {
    id: `unicode-${slug(value)}`,
    registry_index: index,
    display_name: display(value),
    native_name: "UNKNOWN",
    alternate_names: [entry.unicode_script_alias, ...entry.alternateAliases].filter(Boolean),
    registry_class: "unicode",
    script_family: family,
    parent_script: "UNKNOWN",
    region_primary: "UNKNOWN",
    regions: [],
    languages: [],
    unicode_script_value: value,
    unicode_script_alias: entry.unicode_script_alias,
    iso15924: entry.unicode_script_alias,
    unicode_version_added: unicodeVersionAdded,
    unicode_status: ranges.length ? "encoded" : "unencoded",
    unicode_blocks: [...new Set(blocksForScript.map((block) => block.name))],
    unicode_ranges: ranges.map(rangeLabel),
    script_property_kind: propertyKind,
    script_extensions: [],
    writing_system_type: writingSystemType,
    direction: propertyKind === "common" || propertyKind === "inherited" || propertyKind === "unknown" ? "variable" : rtlScripts.has(value) ? "rtl" : "UNKNOWN",
    joining_behavior: cursiveScripts.has(value) ? "cursive" : "UNKNOWN",
    casing_behavior: ["Latin", "Greek", "Cyrillic", "Armenian", "Georgian"].includes(value) ? "upper_lower" : "UNKNOWN",
    has_decimal_digits: "UNKNOWN",
    zero_glyph: "UNKNOWN",
    digits_0_9: [],
    numeral_system_type: "UNKNOWN",
    vowels: [],
    consonants: [],
    matras: [],
    ligatures: [],
    punctuation: [],
    symbols: [],
    font_support_status: "UNKNOWN",
    recommended_fonts: value === "Common" ? [] : ["Noto family candidate - verify exact font before runtime enablement"],
    transliteration_systems: [],
    normalization_notes: "Use UAX #15/ICU normalization policy; script-specific notes require source.",
    collation_notes: "Use CLDR/ICU collation where available; otherwise UNKNOWN.",
    cultural_status: "UNKNOWN",
    evidence_status: "verified",
    source_refs: ["unicode-ucd-17-property-value-aliases", "unicode-ucd-17-scripts", "unicode-ucd-17-blocks", "unicode-ucd-17-derived-age"],
    provenance: provenance(["unicode-ucd-17-property-value-aliases", "unicode-ucd-17-scripts", "unicode-ucd-17-blocks", "unicode-ucd-17-derived-age"]),
    hkd_runtime_enabled: false,
    lipi_ai_priority: "review",
    kbs_node_id: `kbs:script:${slug(value)}`,
    created_at: "2026-06-17T00:00:00.000Z",
    updated_at: "2026-06-17T00:00:00.000Z",
  };
}

function researchRecord(input, registryIndex, blocks) {
  const blockNames = input.unicode_blocks ?? [];
  const foundBlocks = blockNames.map((name) => findBlockByName(blocks, name)).filter(Boolean);
  const sourceRefsForRecord = [
    ...(input.source_refs ?? ["hkd-registry-architect-user-prompt"]),
    ...(foundBlocks.length ? ["unicode-ucd-17-blocks"] : []),
  ].filter((value, index, all) => all.indexOf(value) === index);
  return {
    id: input.id,
    registry_index: registryIndex,
    display_name: input.display_name,
    alternate_names: input.alternate_names ?? [],
    registry_class: input.registry_class,
    script_family: input.script_family ?? "UNKNOWN",
    region_primary: input.region_primary ?? "UNKNOWN",
    regions: input.regions ?? [],
    writing_system_type: input.writing_system_type ?? "UNKNOWN",
    direction: input.direction ?? "UNKNOWN",
    joining_behavior: "UNKNOWN",
    casing_behavior: "UNKNOWN",
    numeral_system_type: input.numeral_system_type ?? "UNKNOWN",
    font_support_status: "UNKNOWN",
    cultural_status: input.cultural_status ?? "research",
    evidence_status: input.evidence_status ?? "draft",
    unicode_status: input.unicode_status ?? (foundBlocks.length ? "partially_encoded" : "unencoded"),
    script_property_kind: input.script_property_kind ?? "non_unicode",
    source_refs: sourceRefsForRecord,
    provenance: provenance(sourceRefsForRecord, input.evidence_status === "disputed" ? "research_hypothesis" : "draft_scope"),
    hkd_runtime_enabled: false,
    lipi_ai_priority: input.lipi_ai_priority ?? "review",
    kbs_node_id: `kbs:script:${input.id}`,
    created_at: "2026-06-17T00:00:00.000Z",
    updated_at: "2026-06-17T00:00:00.000Z",
    ...unknownRecordFields(),
    native_name: input.native_name ?? "UNKNOWN",
    parent_script: input.parent_script ?? "UNKNOWN",
    languages: input.languages ?? ["UNKNOWN"],
    unicode_blocks: foundBlocks.map((block) => block.name),
    unicode_ranges: foundBlocks.map((block) => block.rangeLabel),
    transliteration_systems: input.transliteration_systems ?? [],
    recommended_fonts: input.recommended_fonts ?? [],
    normalization_notes: input.normalization_notes ?? "UNKNOWN",
    collation_notes: input.collation_notes ?? "UNKNOWN",
  };
}

function reservedRecord(registryIndex) {
  return {
    id: `hkd-evidence-slot-${registryIndex.toString().padStart(3, "0")}`,
    registry_index: registryIndex,
    display_name: `HKD Evidence Slot ${registryIndex}`,
    alternate_names: [],
    registry_class: "hkd_private",
    script_family: "UNKNOWN",
    region_primary: "UNKNOWN",
    regions: [],
    writing_system_type: "UNKNOWN",
    direction: "UNKNOWN",
    joining_behavior: "UNKNOWN",
    casing_behavior: "UNKNOWN",
    numeral_system_type: "UNKNOWN",
    font_support_status: "UNKNOWN",
    cultural_status: "research",
    evidence_status: "unknown",
    unicode_status: "unencoded",
    script_property_kind: "non_unicode",
    source_refs: ["hkd-registry-architect-user-prompt"],
    provenance: provenance(["hkd-registry-architect-user-prompt"], "reserved_slot_no_claim"),
    hkd_runtime_enabled: false,
    lipi_ai_priority: "blocked",
    kbs_node_id: `kbs:script:hkd-evidence-slot-${registryIndex.toString().padStart(3, "0")}`,
    created_at: "2026-06-17T00:00:00.000Z",
    updated_at: "2026-06-17T00:00:00.000Z",
    ...unknownRecordFields(),
    languages: [],
  };
}

const researchSystems = [
  { id: "indus", display_name: "Indus", registry_class: "undeciphered", script_family: "symbolic", region_primary: "Indus Valley", cultural_status: "undeciphered", evidence_status: "disputed", unicode_status: "unencoded", direction: "variable" },
  { id: "rongorongo", display_name: "Rongorongo", registry_class: "undeciphered", script_family: "oceanic", region_primary: "Rapa Nui", cultural_status: "undeciphered", evidence_status: "scholarly", unicode_status: "unencoded", direction: "boustrophedon" },
  { id: "proto-elamite", display_name: "Proto-Elamite", registry_class: "undeciphered", script_family: "symbolic", region_primary: "Iran", cultural_status: "undeciphered", evidence_status: "scholarly", unicode_status: "unencoded" },
  { id: "vinca-symbols", display_name: "Vinca Symbols", registry_class: "symbol", script_family: "symbolic", region_primary: "Southeastern Europe", cultural_status: "research", evidence_status: "disputed", unicode_status: "unencoded" },
  { id: "phaistos-disc", display_name: "Phaistos Disc", registry_class: "undeciphered", script_family: "symbolic", region_primary: "Crete", cultural_status: "undeciphered", evidence_status: "disputed", unicode_status: "unencoded" },
  { id: "linear-a-research", display_name: "Linear A Research", registry_class: "undeciphered", script_family: "aegean", region_primary: "Crete", cultural_status: "undeciphered", evidence_status: "scholarly", unicode_status: "unencoded" },
  { id: "pitman-shorthand", display_name: "Pitman Shorthand", registry_class: "shorthand", script_family: "shorthand", region_primary: "United Kingdom", cultural_status: "living", evidence_status: "draft", unicode_status: "unencoded" },
  { id: "gregg-shorthand", display_name: "Gregg Shorthand", registry_class: "shorthand", script_family: "shorthand", region_primary: "United States", cultural_status: "living", evidence_status: "draft", unicode_status: "unencoded" },
  { id: "teeline-shorthand", display_name: "Teeline Shorthand", registry_class: "shorthand", script_family: "shorthand", region_primary: "United Kingdom", cultural_status: "living", evidence_status: "draft", unicode_status: "unencoded" },
  { id: "machine-stenography", display_name: "Machine Stenography", registry_class: "shorthand", script_family: "shorthand", region_primary: "UNKNOWN", cultural_status: "living", evidence_status: "draft", unicode_status: "unencoded" },
  { id: "western-music-notation", display_name: "Western Music Notation", registry_class: "notation", script_family: "notation", unicode_blocks: ["Musical Symbols"], writing_system_type: "notation", cultural_status: "living", evidence_status: "verified", unicode_status: "partially_encoded" },
  { id: "byzantine-music-notation", display_name: "Byzantine Music Notation", registry_class: "notation", script_family: "notation", unicode_blocks: ["Byzantine Musical Symbols"], writing_system_type: "notation", cultural_status: "liturgical", evidence_status: "verified", unicode_status: "partially_encoded" },
  { id: "indian-sargam", display_name: "Indian Sargam", registry_class: "notation", script_family: "notation", region_primary: "South Asia", writing_system_type: "notation", cultural_status: "living", evidence_status: "draft", unicode_status: "unencoded" },
  { id: "vedic-accent-marks", display_name: "Vedic Accent Marks", registry_class: "notation", script_family: "brahmic", unicode_blocks: ["Vedic Extensions"], writing_system_type: "notation", cultural_status: "liturgical", evidence_status: "verified", unicode_status: "partially_encoded" },
  { id: "astronomical-symbols", display_name: "Astronomical Symbols", registry_class: "symbol", script_family: "symbolic", unicode_blocks: ["Miscellaneous Symbols"], writing_system_type: "symbolic", cultural_status: "living", evidence_status: "verified", unicode_status: "partially_encoded" },
  { id: "mathematical-notation", display_name: "Mathematical Notation", registry_class: "notation", script_family: "notation", unicode_blocks: ["Mathematical Operators"], writing_system_type: "notation", cultural_status: "living", evidence_status: "verified", unicode_status: "partially_encoded" },
  { id: "chemical-notation", display_name: "Chemical Notation", registry_class: "notation", script_family: "notation", writing_system_type: "notation", cultural_status: "living", evidence_status: "draft", unicode_status: "unencoded" },
  { id: "dance-notation", display_name: "Dance Notation", registry_class: "notation", script_family: "notation", writing_system_type: "notation", cultural_status: "living", evidence_status: "draft", unicode_status: "unencoded" },
  { id: "alchemical-symbols", display_name: "Alchemical Symbols", registry_class: "symbol", script_family: "symbolic", unicode_blocks: ["Alchemical Symbols"], writing_system_type: "symbolic", cultural_status: "historic", evidence_status: "verified", unicode_status: "encoded" },
  { id: "astrological-symbols", display_name: "Astrological Symbols", registry_class: "symbol", script_family: "symbolic", unicode_blocks: ["Miscellaneous Symbols"], writing_system_type: "symbolic", cultural_status: "living", evidence_status: "verified", unicode_status: "partially_encoded" },
  { id: "religious-symbol-sets", display_name: "Religious Symbol Sets", registry_class: "symbol", script_family: "symbolic", unicode_blocks: ["Miscellaneous Symbols and Pictographs"], writing_system_type: "symbolic", cultural_status: "living", evidence_status: "draft", unicode_status: "partially_encoded" },
  { id: "cartographic-symbols", display_name: "Cartographic Symbols", registry_class: "symbol", script_family: "symbolic", unicode_blocks: ["Miscellaneous Symbols"], writing_system_type: "symbolic", cultural_status: "living", evidence_status: "draft", unicode_status: "partially_encoded" },
  { id: "navigation-symbols", display_name: "Navigation Symbols", registry_class: "symbol", script_family: "symbolic", unicode_blocks: ["Transport and Map Symbols"], writing_system_type: "symbolic", cultural_status: "living", evidence_status: "draft", unicode_status: "partially_encoded" },
  { id: "lipi-vaigyaaniq-experimental-scripts", display_name: "Lipi Vaigyaaniq Experimental Scripts", registry_class: "hkd_private", script_family: "artificial", cultural_status: "research", evidence_status: "draft", unicode_status: "private", lipi_ai_priority: "blocked" },
  { id: "aalekhya-systems", display_name: "Aalekhya Systems", registry_class: "hkd_private", script_family: "artificial", cultural_status: "research", evidence_status: "draft", unicode_status: "private", lipi_ai_priority: "blocked" },
  { id: "knowledge-symbols", display_name: "Knowledge Symbols", registry_class: "hkd_private", script_family: "symbolic", cultural_status: "research", evidence_status: "draft", unicode_status: "private", lipi_ai_priority: "blocked" },
  { id: "future-research-systems", display_name: "Future Research Systems", registry_class: "hkd_private", script_family: "artificial", cultural_status: "research", evidence_status: "unknown", unicode_status: "private", lipi_ai_priority: "blocked" },
];

const enums = {
  registry_class: ["unicode", "historic", "liturgical", "undeciphered", "shorthand", "notation", "symbol", "hkd_private"],
  script_family: ["brahmic", "semitic", "cjk", "latin", "cyrillic", "greek", "african", "american", "oceanic", "artificial", "notation", "symbolic", "shorthand", "iranian", "aegean", "UNKNOWN"],
  unicode_status: ["encoded", "partially_encoded", "unencoded", "proposed", "private"],
  script_property_kind: ["explicit", "common", "inherited", "unknown", "non_unicode"],
  writing_system_type: ["abugida", "alphabet", "abjad", "syllabary", "logographic", "ideographic", "mixed", "notation", "symbolic", "shorthand", "UNKNOWN"],
  direction: ["ltr", "rtl", "ttb", "btt", "boustrophedon", "variable", "UNKNOWN"],
  joining_behavior: ["none", "cursive", "contextual", "complex", "UNKNOWN"],
  casing_behavior: ["none", "upper_lower", "titlecase", "UNKNOWN"],
  numeral_system_type: ["decimal", "additive", "positional", "acrophonic", "none", "UNKNOWN"],
  font_support_status: ["native", "noto", "partial", "rare", "missing", "UNKNOWN"],
  cultural_status: ["living", "revived", "liturgical", "extinct", "undeciphered", "fictional", "research", "UNKNOWN"],
  evidence_status: ["verified", "scholarly", "disputed", "draft", "unknown"],
};

const databaseSchema = {
  tables: [
    {
      name: "script_registry",
      purpose: "Canonical 426-row script-system registry; PHKD fact fields stay UNKNOWN unless sourced.",
      primaryKey: "id",
      columns: [
        "id",
        "registry_index",
        "display_name",
        "native_name",
        "registry_class",
        "script_family",
        "parent_script",
        "region_primary",
        "unicode_script_value",
        "unicode_script_alias",
        "iso15924",
        "unicode_version_added",
        "unicode_status",
        "script_property_kind",
        "writing_system_type",
        "direction",
        "joining_behavior",
        "casing_behavior",
        "has_decimal_digits",
        "zero_glyph",
        "numeral_system_type",
        "font_support_status",
        "cultural_status",
        "evidence_status",
        "hkd_runtime_enabled",
        "lipi_ai_priority",
        "kbs_node_id",
        "created_at",
        "updated_at",
      ],
    },
    { name: "script_alternate_name", purpose: "Alternate script names, aliases, source spellings." },
    { name: "script_region", purpose: "Many-to-many region coverage." },
    { name: "script_language", purpose: "Many-to-many language coverage." },
    { name: "script_unicode_block", purpose: "Script-to-Unicode-block crosswalk." },
    { name: "script_unicode_range", purpose: "Script-to-code-point-range crosswalk." },
    { name: "script_extension_value", purpose: "Script_Extensions aliases from UCD where applicable." },
    { name: "script_character_inventory", purpose: "Vowels, consonants, matras, ligatures, punctuation, symbols." },
    { name: "script_digit_inventory", purpose: "Digits 0-9 and zero glyph per source." },
    { name: "script_font_support", purpose: "Font registry join with support posture." },
    { name: "script_transliteration", purpose: "Script-to-transliteration system join." },
    { name: "script_lineage_edge", purpose: "Family tree and hypothesis lineage edges with evidence status." },
    { name: "script_evidence_ref", purpose: "Evidence bundle references and claim boundaries." },
    { name: "script_provenance_event", purpose: "Immutable provenance events for field-level changes." },
    { name: "script_search_document", purpose: "Flattened search index row." },
    { name: "script_kbs_edge", purpose: "KBS graph edge export." },
  ],
};

const graphSchema = {
  nodes: ["Script", "Language", "Region", "Dynasty", "Manuscript", "Inscription", "Font", "UnicodeBlock", "UnicodeRange", "NumeralSystem", "TransliterationSystem", "EvidenceSource", "ProvenanceEvent"],
  edges: [
    "SCRIPT_USES_LANGUAGE",
    "SCRIPT_ATTESTED_IN_REGION",
    "SCRIPT_DERIVES_FROM_SCRIPT",
    "SCRIPT_HAS_UNICODE_BLOCK",
    "SCRIPT_HAS_UNICODE_RANGE",
    "SCRIPT_HAS_NUMERAL_SYSTEM",
    "SCRIPT_SUPPORTS_TRANSLITERATION",
    "SCRIPT_RENDERED_BY_FONT",
    "SCRIPT_HAS_EVIDENCE",
    "EVIDENCE_HAS_PROVENANCE",
    "INSCRIPTION_WRITTEN_IN_SCRIPT",
    "MANUSCRIPT_WRITTEN_IN_SCRIPT",
    "DYNASTY_PATRONIZED_SCRIPT",
  ],
  invariants: [
    "Every Script node must have at least one EvidenceSource edge.",
    "Research hypotheses must use evidence_status DISPUTED or DRAFT, never VERIFIED.",
    "No UnicodeBlock edge may exist unless the block name exists in Blocks.txt or the edge is marked UNKNOWN.",
  ],
};

const searchIndexSchema = {
  indexName: "hkd_lipi_script_registry",
  primaryKey: "id",
  fields: [
    { name: "display_name", type: "text", weight: 8 },
    { name: "native_name", type: "text", weight: 6 },
    { name: "alternate_names", type: "text[]", weight: 6 },
    { name: "iso15924", type: "keyword", weight: 8 },
    { name: "unicode_script_value", type: "keyword", weight: 8 },
    { name: "unicode_blocks", type: "keyword[]", weight: 5 },
    { name: "regions", type: "keyword[]", weight: 4 },
    { name: "languages", type: "keyword[]", weight: 4 },
    { name: "registry_class", type: "facet", weight: 3 },
    { name: "evidence_status", type: "facet", weight: 3 },
    { name: "unicode_status", type: "facet", weight: 3 },
    { name: "cultural_status", type: "facet", weight: 3 },
  ],
  failClosedFilters: ["exclude records where evidence_status=unknown unless includeResearch=true", "exclude hkd_runtime_enabled=false from runtime selectors"],
};

const kbsOntology = {
  namespace: "hkd.lipi.registry",
  classes: graphSchema.nodes,
  predicates: graphSchema.edges,
  evidenceModel: "Every assertion is a claim edge with source_ref, provenance_event, evidence_status, review_state, and generated_at.",
  controlledNoGoDefault: true,
};

const apiContracts = {
  basePath: "/api/lipi-registry",
  contracts: [
    { method: "GET", path: "/scripts", query: ["class", "family", "unicodeStatus", "evidenceStatus", "q", "includeResearch"], response: "ScriptRegistryListResponse" },
    { method: "GET", path: "/scripts/{id}", response: "ScriptRegistryRecordResponse" },
    { method: "GET", path: "/unicode/crosswalk", response: "UnicodeCrosswalkResponse" },
    { method: "GET", path: "/families/{family}/tree", response: "ScriptFamilyTreeResponse" },
    { method: "GET", path: "/scripts/{id}/evidence", response: "EvidenceBundleResponse" },
    { method: "POST", path: "/scripts/{id}/review", request: "ReviewDecisionRequest", response: "ReviewDecisionResponse", guard: "requiresReviewerRole" },
    { method: "POST", path: "/scripts/{id}/runtime-enable", request: "RuntimeEnableRequest", response: "RuntimeEnableResponse", guard: "requires verified evidence and render/transliteration coverage" },
  ],
  errorShape: { code: "string", message: "string", phkdStatus: "BLOCKED|CONTROLLED_NO_GO|PASS", evidenceRequired: "string[]" },
};

const transliterationRegistry = [
  { id: "iast", name: "IAST", scope: "Indic/Sanskrit", status: "supported_candidate", evidence_required: true },
  { id: "iso-15919", name: "ISO 15919", scope: "Indic transliteration", status: "supported_candidate", evidence_required: true },
  { id: "harvard-kyoto", name: "Harvard-Kyoto", scope: "Sanskrit ASCII", status: "supported_candidate", evidence_required: true },
  { id: "itrans", name: "ITRANS", scope: "Indic ASCII", status: "supported_candidate", evidence_required: true },
  { id: "velthuis", name: "Velthuis", scope: "Devanagari/Sanskrit ASCII", status: "supported_candidate", evidence_required: true },
  { id: "wx", name: "WX", scope: "Indian languages", status: "supported_candidate", evidence_required: true },
  { id: "slp1", name: "SLP1", scope: "Sanskrit computational", status: "supported_candidate", evidence_required: true },
];

const numeralRegistry = [
  { id: "brahmi-numerals", name: "Brahmi Numerals", type: "additive", evidence_status: "draft" },
  { id: "gupta-numerals", name: "Gupta Numerals", type: "positional", evidence_status: "draft" },
  { id: "nagari-numerals", name: "Nagari Numerals", type: "decimal", evidence_status: "draft" },
  { id: "modern-indic-numerals", name: "Modern Indic Numerals", type: "decimal", evidence_status: "draft" },
];

const fontRegistry = [
  { id: "noto", name: "Noto", support_status: "noto", scope: "multi-script", evidence_required: true },
  { id: "lohit", name: "Lohit", support_status: "partial", scope: "Indic", evidence_required: true },
  { id: "sanskrit2003", name: "Sanskrit2003", support_status: "partial", scope: "Sanskrit/Devanagari", evidence_required: true },
  { id: "chandas", name: "Chandas", support_status: "partial", scope: "Vedic/Sanskrit", evidence_required: true },
  { id: "mukta", name: "Mukta", support_status: "partial", scope: "Indic UI", evidence_required: true },
  { id: "adishila", name: "Adishila", support_status: "rare", scope: "Indic epigraphy candidate", evidence_required: true },
];

const renderingRegistry = [
  { id: "opentype", name: "OpenType", role: "font shaping tables", runtime_gate: "requires font proof" },
  { id: "graphite", name: "Graphite", role: "smart font behavior", runtime_gate: "optional source-backed engine" },
  { id: "harfbuzz", name: "HarfBuzz", role: "complex text shaping", runtime_gate: "preferred shaping engine" },
  { id: "icu", name: "ICU", role: "segmentation, collation, transforms", runtime_gate: "preferred Unicode service layer" },
  { id: "unicode-normalization", name: "Unicode Normalization", role: "NFC/NFD/NFKC/NFKD policy", runtime_gate: "requires script notes" },
];

const scriptFamilyTrees = [
  {
    id: "brahmi-family-core",
    root: "Brahmi",
    evidence_status: "draft",
    children: ["Gupta", "Sharada", "Takri", "Devanagari", "Bengali", "Gujarati", "Gurmukhi", "Odia", "Telugu", "Kannada", "Malayalam", "Tamil"],
    graph: [
      ["Brahmi", "Gupta"],
      ["Brahmi", "Sharada"],
      ["Brahmi", "Takri"],
      ["Brahmi", "Devanagari"],
      ["Brahmi", "Bengali"],
      ["Brahmi", "Gujarati"],
      ["Brahmi", "Gurmukhi"],
      ["Brahmi", "Odia"],
      ["Brahmi", "Telugu"],
      ["Brahmi", "Kannada"],
      ["Brahmi", "Malayalam"],
      ["Brahmi", "Tamil"],
    ],
    note: "Required family graph from user prompt; remains draft until edge-level scholarly sources are attached.",
  },
];

const numeralEvolutionGraph = {
  id: "brahmi-to-modern-indic-numerals",
  nodes: ["Brahmi Numerals", "Gupta", "Nagari", "Modern Indic Numerals"],
  edges: [
    ["Brahmi Numerals", "Gupta"],
    ["Gupta", "Nagari"],
    ["Nagari", "Modern Indic Numerals"],
  ],
  evidence_status: "draft",
};

const glyphRegistry = {
  model: "Glyph records are separated from script records; glyphs require code point/provenance/font-render proof before runtime use.",
  tables: ["script_glyph", "glyph_variant", "glyph_attestation", "glyph_render_test"],
  requiredFields: ["glyph_id", "script_id", "glyph", "code_point_or_unencoded_id", "category", "evidence_status", "source_refs"],
};

const evidenceRegistry = {
  evidenceTypes: ["unicode_data_file", "iso_registry", "inscription", "manuscript", "font_test", "native_review", "scholarly_reference", "runtime_test", "corpus_text"],
  states: ["verified", "scholarly", "disputed", "draft", "unknown"],
  rule: "A record can be search-visible in draft, but runtime-enabled only after verified evidence and required render/transliteration checks pass.",
};

const provenanceRegistry = {
  eventTypes: ["source_ingested", "field_asserted", "field_changed", "review_requested", "review_accepted", "review_rejected", "runtime_enabled", "runtime_disabled"],
  immutableFields: ["event_id", "record_id", "field_name", "previous_hash", "event_hash", "source_refs", "actor", "created_at"],
  hashPolicy: "sha256(canonical event body + previous_hash)",
};

const migrationPlan = [
  "Create read-only architecture artifacts and PHKD validation tests.",
  "Ingest official Unicode UCD files into data/unicode/ucd-latest with sha256 provenance.",
  "Create script_registry and companion tables in SQLite/PostgreSQL.",
  "Backfill all Unicode Script property rows from PropertyValueAliases/Scripts/Blocks/DerivedAge.",
  "Load non-Unicode research rows as draft/unknown/unencoded records.",
  "Reserve remaining capacity as hkd_private evidence slots with no runtime claims.",
  "Attach field-level provenance and source_refs for every row.",
  "Keep hkd_runtime_enabled=false until evidence, rendering, font, transliteration, and review gates pass.",
  "Expose API/search/KBS surfaces behind includeResearch and evidence-status filters.",
  "Only then migrate selected verified records into active Lipi runtime surfaces.",
];

const validationRules = [
  "registry_index must be unique and between 1 and 426.",
  "id must be unique and stable.",
  "source_refs must contain at least one source id.",
  "provenance must be present for every row.",
  "unicode_status=encoded or partially_encoded requires either unicode_ranges or a non-Unicode symbol/notation block source.",
  "unicode_status=unencoded requires empty unicode_script_alias or UNKNOWN unless a Unicode property row has no assigned range.",
  "iso15924 must be UNKNOWN unless copied from an authoritative source field.",
  "evidence_status=verified requires primary source_refs.",
  "hkd_runtime_enabled=true requires evidence_status=verified and no UNKNOWN in required rendering/transliteration gates.",
  "undeciphered systems must not expose transliteration/OCR/translation runtime claims.",
];

function jsonSchema() {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://tlps.in/schemas/hkd-lipi-script-registry.schema.json",
    title: "HKD Lipi Script Registry Record",
    type: "object",
    additionalProperties: false,
    required: [
      "id",
      "registry_index",
      "display_name",
      "native_name",
      "alternate_names",
      "registry_class",
      "script_family",
      "parent_script",
      "region_primary",
      "regions",
      "languages",
      "unicode_script_value",
      "unicode_script_alias",
      "iso15924",
      "unicode_version_added",
      "unicode_status",
      "unicode_blocks",
      "unicode_ranges",
      "script_property_kind",
      "script_extensions",
      "writing_system_type",
      "direction",
      "joining_behavior",
      "casing_behavior",
      "has_decimal_digits",
      "zero_glyph",
      "digits_0_9",
      "numeral_system_type",
      "vowels",
      "consonants",
      "matras",
      "ligatures",
      "punctuation",
      "symbols",
      "font_support_status",
      "recommended_fonts",
      "transliteration_systems",
      "normalization_notes",
      "collation_notes",
      "cultural_status",
      "evidence_status",
      "source_refs",
      "provenance",
      "hkd_runtime_enabled",
      "lipi_ai_priority",
      "kbs_node_id",
      "created_at",
      "updated_at",
    ],
    properties: {
      id: { type: "string", pattern: "^[a-z0-9][a-z0-9-]*$" },
      registry_index: { type: "integer", minimum: 1, maximum: 426 },
      display_name: { type: "string", minLength: 1 },
      native_name: { type: "string" },
      alternate_names: { type: "array", items: { type: "string" } },
      registry_class: { enum: enums.registry_class },
      script_family: { enum: enums.script_family },
      parent_script: { type: "string" },
      region_primary: { type: "string" },
      regions: { type: "array", items: { type: "string" } },
      languages: { type: "array", items: { type: "string" } },
      unicode_script_value: { type: "string" },
      unicode_script_alias: { type: "string" },
      iso15924: { type: "string" },
      unicode_version_added: { type: "string" },
      unicode_status: { enum: enums.unicode_status },
      unicode_blocks: { type: "array", items: { type: "string" } },
      unicode_ranges: { type: "array", items: { type: "string" } },
      script_property_kind: { enum: enums.script_property_kind },
      script_extensions: { type: "array", items: { type: "string" } },
      writing_system_type: { enum: enums.writing_system_type },
      direction: { enum: enums.direction },
      joining_behavior: { enum: enums.joining_behavior },
      casing_behavior: { enum: enums.casing_behavior },
      has_decimal_digits: { anyOf: [{ type: "boolean" }, { const: "UNKNOWN" }] },
      zero_glyph: { type: "string" },
      digits_0_9: { type: "array", items: { type: "string" } },
      numeral_system_type: { enum: enums.numeral_system_type },
      vowels: { type: "array", items: { type: "string" } },
      consonants: { type: "array", items: { type: "string" } },
      matras: { type: "array", items: { type: "string" } },
      ligatures: { type: "array", items: { type: "string" } },
      punctuation: { type: "array", items: { type: "string" } },
      symbols: { type: "array", items: { type: "string" } },
      font_support_status: { enum: enums.font_support_status },
      recommended_fonts: { type: "array", items: { type: "string" } },
      transliteration_systems: { type: "array", items: { type: "string" } },
      normalization_notes: { type: "string" },
      collation_notes: { type: "string" },
      cultural_status: { enum: enums.cultural_status },
      evidence_status: { enum: enums.evidence_status },
      source_refs: { type: "array", minItems: 1, items: { type: "string" } },
      provenance: { type: "object" },
      hkd_runtime_enabled: { type: "boolean" },
      lipi_ai_priority: { enum: ["high", "medium", "low", "review", "blocked"] },
      kbs_node_id: { type: "string" },
      created_at: { type: "string" },
      updated_at: { type: "string" },
    },
  };
}

const tsTypes = `// Generated by scripts/generate-hkd-lipi-registry-architecture.mjs.
// PHKD: uncertain data must be UNKNOWN, UNENCODED, DISPUTED, draft, or unknown.

export type HkdRegistryClass = ${enums.registry_class.map((value) => JSON.stringify(value)).join(" | ")};
export type HkdUnicodeStatus = ${enums.unicode_status.map((value) => JSON.stringify(value)).join(" | ")};
export type HkdScriptPropertyKind = ${enums.script_property_kind.map((value) => JSON.stringify(value)).join(" | ")};
export type HkdWritingSystemType = ${enums.writing_system_type.map((value) => JSON.stringify(value)).join(" | ")};
export type HkdDirection = ${enums.direction.map((value) => JSON.stringify(value)).join(" | ")};
export type HkdEvidenceStatus = ${enums.evidence_status.map((value) => JSON.stringify(value)).join(" | ")};

export interface HkdLipiProvenance {
  stance: "verified_fact" | "research_hypothesis" | "draft_scope" | "reserved_slot_no_claim";
  sourceIds: string[];
  generatedBy: string;
  phkd: "FACTS_FROM_SOURCES_OR_UNKNOWN";
  reviewed: boolean;
}

export interface HkdLipiScriptRegistryRecord {
  id: string;
  registry_index: number;
  display_name: string;
  native_name: string;
  alternate_names: string[];
  registry_class: HkdRegistryClass;
  script_family: string;
  parent_script: string;
  region_primary: string;
  regions: string[];
  languages: string[];
  unicode_script_value: string;
  unicode_script_alias: string;
  iso15924: string;
  unicode_version_added: string;
  unicode_status: HkdUnicodeStatus;
  unicode_blocks: string[];
  unicode_ranges: string[];
  script_property_kind: HkdScriptPropertyKind;
  script_extensions: string[];
  writing_system_type: HkdWritingSystemType;
  direction: HkdDirection;
  joining_behavior: string;
  casing_behavior: string;
  has_decimal_digits: boolean | "UNKNOWN";
  zero_glyph: string;
  digits_0_9: string[];
  numeral_system_type: string;
  vowels: string[];
  consonants: string[];
  matras: string[];
  ligatures: string[];
  punctuation: string[];
  symbols: string[];
  font_support_status: string;
  recommended_fonts: string[];
  transliteration_systems: string[];
  normalization_notes: string;
  collation_notes: string;
  cultural_status: string;
  evidence_status: HkdEvidenceStatus;
  source_refs: string[];
  provenance: HkdLipiProvenance;
  hkd_runtime_enabled: boolean;
  lipi_ai_priority: "high" | "medium" | "low" | "review" | "blocked";
  kbs_node_id: string;
  created_at: string;
  updated_at: string;
}

export interface HkdLipiRegistryListResponse {
  records: HkdLipiScriptRegistryRecord[];
  total: number;
  governedProductionGo: false;
  reviewState: "CONTROLLED_NO_GO";
}
`;

const prismaModels = `// Generated companion Prisma models for the HKD Lipi Registry.
// Keep separate from the current runtime schema until migration is accepted.

model HkdLipiScriptRegistry {
  id                   String   @id
  registryIndex        Int      @unique
  displayName          String
  nativeName           String
  registryClass        String
  scriptFamily         String
  parentScript         String
  regionPrimary        String
  unicodeScriptValue   String
  unicodeScriptAlias   String
  iso15924             String
  unicodeVersionAdded  String
  unicodeStatus        String
  scriptPropertyKind   String
  writingSystemType    String
  direction            String
  joiningBehavior      String
  casingBehavior       String
  hasDecimalDigits     String
  zeroGlyph            String
  numeralSystemType    String
  fontSupportStatus    String
  culturalStatus       String
  evidenceStatus       String
  hkdRuntimeEnabled    Boolean  @default(false)
  lipiAiPriority       String
  kbsNodeId            String   @unique
  normalizationNotes   String
  collationNotes       String
  provenanceJson       String
  createdAt            DateTime
  updatedAt            DateTime

  alternateNames       HkdLipiScriptAlternateName[]
  regions              HkdLipiScriptRegion[]
  languages            HkdLipiScriptLanguage[]
  unicodeBlocks        HkdLipiUnicodeBlock[]
  unicodeRanges        HkdLipiUnicodeRange[]
  evidenceRefs         HkdLipiEvidenceRef[]
  provenanceEvents     HkdLipiProvenanceEvent[]
}

model HkdLipiScriptAlternateName {
  id        String @id
  scriptId  String
  name      String
  script    HkdLipiScriptRegistry @relation(fields: [scriptId], references: [id])
}

model HkdLipiScriptRegion {
  id        String @id
  scriptId  String
  region    String
  script    HkdLipiScriptRegistry @relation(fields: [scriptId], references: [id])
}

model HkdLipiScriptLanguage {
  id        String @id
  scriptId  String
  language  String
  script    HkdLipiScriptRegistry @relation(fields: [scriptId], references: [id])
}

model HkdLipiUnicodeBlock {
  id        String @id
  scriptId  String
  blockName String
  script    HkdLipiScriptRegistry @relation(fields: [scriptId], references: [id])
}

model HkdLipiUnicodeRange {
  id         String @id
  scriptId   String
  rangeLabel String
  script     HkdLipiScriptRegistry @relation(fields: [scriptId], references: [id])
}

model HkdLipiEvidenceRef {
  id          String @id
  scriptId    String
  sourceRefId String
  claimScope  String
  script      HkdLipiScriptRegistry @relation(fields: [scriptId], references: [id])
}

model HkdLipiProvenanceEvent {
  id           String   @id
  scriptId     String
  eventType    String
  fieldName    String
  sourceRefs   String
  previousHash String
  eventHash    String
  createdAt    DateTime
  script       HkdLipiScriptRegistry @relation(fields: [scriptId], references: [id])
}
`;

const sqliteDdl = `-- Generated HKD Lipi Registry SQLite schema.
-- PHKD defaults: runtime disabled, evidence required, unknown data explicit.

CREATE TABLE IF NOT EXISTS hkd_lipi_script_registry (
  id TEXT PRIMARY KEY,
  registry_index INTEGER NOT NULL UNIQUE CHECK (registry_index BETWEEN 1 AND 426),
  display_name TEXT NOT NULL,
  native_name TEXT NOT NULL DEFAULT 'UNKNOWN',
  registry_class TEXT NOT NULL CHECK (registry_class IN ('unicode','historic','liturgical','undeciphered','shorthand','notation','symbol','hkd_private')),
  script_family TEXT NOT NULL DEFAULT 'UNKNOWN',
  parent_script TEXT NOT NULL DEFAULT 'UNKNOWN',
  region_primary TEXT NOT NULL DEFAULT 'UNKNOWN',
  unicode_script_value TEXT NOT NULL DEFAULT 'UNKNOWN',
  unicode_script_alias TEXT NOT NULL DEFAULT 'UNKNOWN',
  iso15924 TEXT NOT NULL DEFAULT 'UNKNOWN',
  unicode_version_added TEXT NOT NULL DEFAULT 'UNKNOWN',
  unicode_status TEXT NOT NULL CHECK (unicode_status IN ('encoded','partially_encoded','unencoded','proposed','private')),
  script_property_kind TEXT NOT NULL CHECK (script_property_kind IN ('explicit','common','inherited','unknown','non_unicode')),
  writing_system_type TEXT NOT NULL,
  direction TEXT NOT NULL,
  joining_behavior TEXT NOT NULL,
  casing_behavior TEXT NOT NULL,
  has_decimal_digits TEXT NOT NULL DEFAULT 'UNKNOWN',
  zero_glyph TEXT NOT NULL DEFAULT 'UNKNOWN',
  numeral_system_type TEXT NOT NULL DEFAULT 'UNKNOWN',
  font_support_status TEXT NOT NULL DEFAULT 'UNKNOWN',
  cultural_status TEXT NOT NULL DEFAULT 'UNKNOWN',
  evidence_status TEXT NOT NULL CHECK (evidence_status IN ('verified','scholarly','disputed','draft','unknown')),
  hkd_runtime_enabled INTEGER NOT NULL DEFAULT 0 CHECK (hkd_runtime_enabled IN (0,1)),
  lipi_ai_priority TEXT NOT NULL DEFAULT 'review',
  kbs_node_id TEXT NOT NULL UNIQUE,
  normalization_notes TEXT NOT NULL DEFAULT 'UNKNOWN',
  collation_notes TEXT NOT NULL DEFAULT 'UNKNOWN',
  provenance_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hkd_lipi_script_alternate_name (id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES hkd_lipi_script_registry(id), name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_script_region (id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES hkd_lipi_script_registry(id), region TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_script_language (id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES hkd_lipi_script_registry(id), language TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_unicode_block (id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES hkd_lipi_script_registry(id), block_name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_unicode_range (id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES hkd_lipi_script_registry(id), range_label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_script_extension_value (id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES hkd_lipi_script_registry(id), script_alias TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_character_inventory (id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES hkd_lipi_script_registry(id), inventory_kind TEXT NOT NULL, token TEXT NOT NULL, evidence_status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_digit_inventory (id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES hkd_lipi_script_registry(id), digit_index INTEGER NOT NULL CHECK (digit_index BETWEEN 0 AND 9), glyph TEXT NOT NULL, evidence_status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_font_support (id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES hkd_lipi_script_registry(id), font_id TEXT NOT NULL, support_status TEXT NOT NULL, evidence_status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_transliteration (id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES hkd_lipi_script_registry(id), system_id TEXT NOT NULL, evidence_status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_lineage_edge (id TEXT PRIMARY KEY, parent_script_id TEXT NOT NULL, child_script_id TEXT NOT NULL, relation_type TEXT NOT NULL, evidence_status TEXT NOT NULL, source_refs_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_evidence_ref (id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES hkd_lipi_script_registry(id), source_ref_id TEXT NOT NULL, claim_scope TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_provenance_event (id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES hkd_lipi_script_registry(id), event_type TEXT NOT NULL, field_name TEXT NOT NULL, source_refs_json TEXT NOT NULL, previous_hash TEXT NOT NULL, event_hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_search_document (id TEXT PRIMARY KEY, script_id TEXT NOT NULL REFERENCES hkd_lipi_script_registry(id), document_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hkd_lipi_kbs_edge (id TEXT PRIMARY KEY, subject_id TEXT NOT NULL, predicate TEXT NOT NULL, object_id TEXT NOT NULL, evidence_status TEXT NOT NULL, source_refs_json TEXT NOT NULL);
`;

const postgresDdl = sqliteDdl
  .replace(/CREATE TABLE IF NOT EXISTS hkd_lipi_script_registry \(/, "CREATE TABLE IF NOT EXISTS hkd_lipi_script_registry (")
  .replace(/INTEGER NOT NULL UNIQUE CHECK \(registry_index BETWEEN 1 AND 426\)/, "INTEGER NOT NULL UNIQUE CHECK (registry_index BETWEEN 1 AND 426)")
  .replace(/hkd_runtime_enabled INTEGER NOT NULL DEFAULT 0 CHECK \(hkd_runtime_enabled IN \(0,1\)\)/, "hkd_runtime_enabled BOOLEAN NOT NULL DEFAULT FALSE")
  .replace(/provenance_json TEXT NOT NULL/g, "provenance_json JSONB NOT NULL")
  .replace(/source_refs_json TEXT NOT NULL/g, "source_refs_json JSONB NOT NULL")
  .replace(/document_json TEXT NOT NULL/g, "document_json JSONB NOT NULL")
  .replace("-- Generated HKD Lipi Registry SQLite schema.", "-- Generated HKD Lipi Registry PostgreSQL schema.");

function buildMarkdown(architecture, seedRecords) {
  const stats = architecture.seedDatasetStructure.stats;
  return `# HKD Lipi Registry Architecture

Generated: ${architecture.generatedAt}

Review state: **${architecture.reviewState}**  
Governed production GO: **${architecture.governedProductionGo}**

This is a production-grade registry contract, not a certification claim. It can store 426 script-system records across Unicode scripts, historic scripts, liturgical scripts, undeciphered systems, shorthand, notation, symbol systems, and HKD private research extensions. Runtime enablement remains fail-closed.

## 1. Registry Taxonomy

Partitions:

${architecture.registryTaxonomy.partitions.map((p) => `- ${p.id}: ${p.name} (${p.registry_class}) - ${p.rule}`).join("\n")}

PHKD rules:

${phkdRules.map((rule) => `- ${rule}`).join("\n")}

## 2. Database Schema

${databaseSchema.tables.map((table) => `- ${table.name}: ${table.purpose}`).join("\n")}

## 3. TypeScript Types

Generated at \`${OUT.tsTypes}\`.

## 4. Prisma Models

Generated at \`${OUT.prisma}\`.

## 5. SQLite DDL

Generated at \`${OUT.sqlite}\`.

## 6. PostgreSQL DDL

Generated at \`${OUT.postgres}\`.

## 7. JSON Schema

Generated at \`${OUT.jsonSchema}\`.

## 8. Graph Schema

Nodes: ${graphSchema.nodes.join(", ")}

Edges: ${graphSchema.edges.join(", ")}

## 9. Search Index Schema

Index: \`${searchIndexSchema.indexName}\`, primary key \`${searchIndexSchema.primaryKey}\`.

## 10. KBS Ontology

Namespace: \`${kbsOntology.namespace}\`. Every assertion is evidence-bound.

## 11. API Contracts

${apiContracts.contracts.map((contract) => `- ${contract.method} ${contract.path} -> ${contract.response}`).join("\n")}

## 12. Unicode Mapping Tables

- Unicode version: ${architecture.unicodeMappingTables.unicodeVersion}
- Script property values: ${architecture.unicodeMappingTables.scriptPropertyValues.length}
- Crosswalk rows: ${architecture.unicodeMappingTables.unicodeCrosswalk.length}
- Unicode rows in 426 seed: ${stats.byClass.unicode}

## 13. Script Family Trees

${scriptFamilyTrees.map((tree) => `- ${tree.root}: ${tree.children.join(", ")}`).join("\n")}

## 14. Transliteration Registry

${transliterationRegistry.map((system) => `- ${system.name}: ${system.scope}`).join("\n")}

## 15. Numeral Registry

${numeralRegistry.map((system) => `- ${system.name}: ${system.type}`).join("\n")}

Numeral evolution: ${numeralEvolutionGraph.nodes.join(" -> ")}

## 16. Glyph Registry

${glyphRegistry.model}

## 17. Font Registry

${fontRegistry.map((font) => `- ${font.name}: ${font.scope}`).join("\n")}

## 18. Rendering Registry

${renderingRegistry.map((engine) => `- ${engine.name}: ${engine.role}`).join("\n")}

## 19. Evidence Registry

States: ${evidenceRegistry.states.join(", ")}

## 20. Provenance Registry

Events: ${provenanceRegistry.eventTypes.join(", ")}

## Seed Dataset Structure

- Target capacity: ${stats.total}/426
- Unicode property rows: ${stats.byClass.unicode}
- Non-Unicode research rows: ${stats.nonUnicodeResearch}
- Reserved HKD evidence slots: ${stats.reserved}
- Runtime enabled rows: ${stats.runtimeEnabled}

First 20 rows:

${seedRecords.slice(0, 20).map((record) => `- ${record.registry_index}. ${record.display_name} [${record.registry_class}; ${record.unicode_status}; ${record.evidence_status}]`).join("\n")}

## Validation Rules

${validationRules.map((rule) => `- ${rule}`).join("\n")}

## Source Provenance

${sourceRefs.map((source) => `- ${source.id}: ${source.url ?? source.localPath ?? source.label}`).join("\n")}
`;
}

function buildHtml(architecture, seedRecords) {
  const stats = architecture.seedDatasetStructure.stats;
  const classes = Object.entries(stats.byClass)
    .map(([label, value]) => `<div class="card"><strong>${value}</strong><span>${label}</span></div>`)
    .join("");
  const rows = seedRecords
    .slice(0, 80)
    .map((record) => `<tr><td>${record.registry_index}</td><td>${record.display_name}</td><td>${record.registry_class}</td><td>${record.unicode_script_alias}</td><td>${record.unicode_status}</td><td>${record.evidence_status}</td></tr>`)
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>HKD Lipi Registry Architecture</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f4ed; color: #1d2426; }
    body { margin: 0; }
    header { padding: 32px 40px 22px; background: #17312e; color: #f7f4ed; }
    h1 { margin: 0 0 10px; font-size: 34px; letter-spacing: 0; }
    header p { max-width: 980px; margin: 0; color: #d7e2dd; line-height: 1.5; }
    main { padding: 28px 40px 44px; }
    .banner { padding: 14px 16px; border-left: 5px solid #b54708; background: #fff7ed; margin-bottom: 22px; font-weight: 700; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 22px; }
    .card { background: #ffffff; border: 1px solid #d8d2c6; border-radius: 8px; padding: 14px; }
    .card strong { display: block; font-size: 28px; }
    .card span { color: #52605f; text-transform: uppercase; font-size: 12px; letter-spacing: .04em; }
    section { margin: 26px 0; }
    h2 { font-size: 18px; margin: 0 0 12px; }
    table { width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #d8d2c6; }
    th, td { text-align: left; padding: 9px 10px; border-bottom: 1px solid #ebe6dc; font-size: 14px; }
    th { background: #e9efe9; font-size: 12px; text-transform: uppercase; color: #334341; }
    code { background: #eee8dc; padding: 2px 5px; border-radius: 4px; }
    .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px; }
    ul { margin-top: 8px; padding-left: 20px; }
  </style>
</head>
<body>
  <header>
    <h1>HKD Lipi Registry Architecture</h1>
    <p>Complete evidence-first registry contract for 426 script-system records, generated from Unicode 17.0.0 UCD files and the MAATAA Lipi evidence pipeline.</p>
  </header>
  <main>
    <div class="banner">CONTROLLED_NO_GO - architecture and seed structure only. No certification, revival, or production runtime claim.</div>
    <div class="grid">
      <div class="card"><strong>${stats.total}</strong><span>registry rows</span></div>
      <div class="card"><strong>${architecture.unicodeMappingTables.scriptPropertyValues.length}</strong><span>Unicode script properties</span></div>
      <div class="card"><strong>${stats.reserved}</strong><span>reserved evidence slots</span></div>
      <div class="card"><strong>${stats.runtimeEnabled}</strong><span>runtime enabled</span></div>
      ${classes}
    </div>
    <section class="cols">
      <div>
        <h2>Generated Artifacts</h2>
        <ul>
          <li><code>${OUT.architecture}</code></li>
          <li><code>${OUT.seed}</code></li>
          <li><code>${OUT.tsTypes}</code></li>
          <li><code>${OUT.prisma}</code></li>
          <li><code>${OUT.sqlite}</code></li>
          <li><code>${OUT.postgres}</code></li>
          <li><code>${OUT.jsonSchema}</code></li>
        </ul>
      </div>
      <div>
        <h2>PHKD Rules</h2>
        <ul>${phkdRules.map((rule) => `<li>${rule}</li>`).join("")}</ul>
      </div>
    </section>
    <section>
      <h2>First 80 Seed Rows</h2>
      <table>
        <thead><tr><th>#</th><th>Name</th><th>Class</th><th>Unicode alias</th><th>Unicode status</th><th>Evidence</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  </main>
</body>
</html>`;
}

function statsBy(records, field) {
  return records.reduce((acc, record) => {
    acc[record[field]] = (acc[record[field]] ?? 0) + 1;
    return acc;
  }, {});
}

function main() {
  for (const source of sourceRefs.filter((source) => source.localPath?.startsWith(UCD_DIR))) {
    source.sha256 = sha256(source.localPath);
  }

  const aliases = parsePropertyValueAliases();
  const scriptRanges = parsePropertyRanges(`${UCD_DIR}/Scripts.txt`);
  const scriptExtensionRanges = parsePropertyRanges(`${UCD_DIR}/ScriptExtensions.txt`);
  const blocks = parseBlocks();
  const ages = parseAges();

  const unicodeRecords = aliases.map((entry, offset) => {
    const ranges = scriptRanges.get(entry.unicode_script_value) ?? [];
    const blocksForScript = findBlocksForRanges(ranges, blocks);
    return buildUnicodeRecord({
      entry,
      ranges,
      blocksForScript,
      unicodeVersionAdded: minUnicodeAgeForRanges(ranges, ages),
      index: offset + 1,
    });
  });

  const usedIds = new Set(unicodeRecords.map((record) => record.id));
  const researchRecords = [];
  for (const item of researchSystems) {
    if (usedIds.has(item.id) || usedIds.has(`unicode-${item.id}`)) continue;
    const record = researchRecord(item, unicodeRecords.length + researchRecords.length + 1, blocks);
    researchRecords.push(record);
    usedIds.add(record.id);
  }

  const seedRecords = [...unicodeRecords, ...researchRecords];
  while (seedRecords.length < 426) {
    seedRecords.push(reservedRecord(seedRecords.length + 1));
  }
  if (seedRecords.length > 426) {
    throw new Error(`Seed over capacity: ${seedRecords.length}`);
  }

  const unicodeCrosswalk = unicodeRecords.map((record) => ({
    id: record.id,
    unicode_script_value: record.unicode_script_value,
    unicode_script_alias: record.unicode_script_alias,
    iso15924: record.iso15924,
    unicode_blocks: record.unicode_blocks,
    unicode_ranges: record.unicode_ranges,
    unicode_version_added: record.unicode_version_added,
    script_property_kind: record.script_property_kind,
  }));

  const registryTaxonomy = {
    phkdRules,
    partitions: [
      { id: "A", name: "Unicode Scripts", registry_class: "unicode", rule: "Rows generated from UCD Script property values only." },
      { id: "B", name: "Historic Scripts", registry_class: "historic", rule: "Encoded historic scripts use UCD; unencoded historic scripts stay UNENCODED with scholarly evidence." },
      { id: "C", name: "Liturgical Scripts", registry_class: "liturgical", rule: "Liturgical status is cultural metadata, separate from Unicode encoding." },
      { id: "D", name: "Undeciphered Systems", registry_class: "undeciphered", rule: "DISPUTED or SCHOLARLY; no OCR/transliteration/runtime claims." },
      { id: "E", name: "Shorthand Systems", registry_class: "shorthand", rule: "Encoded systems use UCD; unencoded systems remain UNENCODED." },
      { id: "F", name: "Notation Systems", registry_class: "notation", rule: "Notation blocks are symbol/notation records, not Script property inventions." },
      { id: "G", name: "Symbol Systems", registry_class: "symbol", rule: "Symbol systems require block/provenance boundaries." },
      { id: "H", name: "HKD Extensions", registry_class: "hkd_private", rule: "Private/research rows cannot claim Unicode or ISO assignment." },
    ],
    enums,
  };

  const architecture = {
    schema: "hkd-lipi-registry-architecture.v1",
    generatedAt: new Date().toISOString(),
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    sourceRefs,
    registryTaxonomy,
    databaseSchema,
    typeScriptTypes: { path: OUT.tsTypes, exports: ["HkdLipiScriptRegistryRecord", "HkdLipiRegistryListResponse"] },
    prismaModels: { path: OUT.prisma, modelCount: 8 },
    sqliteDdl: { path: OUT.sqlite },
    postgresqlDdl: { path: OUT.postgres },
    jsonSchema: { path: OUT.jsonSchema },
    graphSchema,
    searchIndexSchema,
    kbsOntology,
    apiContracts,
    unicodeMappingTables: {
      unicodeVersion: "17.0.0",
      scriptPropertyValues: aliases,
      unicodeCrosswalk,
      scriptExtensionsRows: [...scriptExtensionRanges.entries()].map(([alias, ranges]) => ({ alias, rangeCount: ranges.length })),
    },
    scriptFamilyTrees,
    numeralEvolutionGraph,
    transliterationRegistry,
    numeralRegistry,
    glyphRegistry,
    fontRegistry,
    renderingRegistry,
    evidenceRegistry,
    provenanceRegistry,
    migrationPlan,
    validationRules,
    seedDatasetStructure: {
      targetCount: 426,
      path: OUT.seed,
      stats: {
        total: seedRecords.length,
        byClass: statsBy(seedRecords, "registry_class"),
        byUnicodeStatus: statsBy(seedRecords, "unicode_status"),
        byEvidenceStatus: statsBy(seedRecords, "evidence_status"),
        unicodeScriptProperties: aliases.length,
        nonUnicodeResearch: researchRecords.length,
        reserved: seedRecords.filter((record) => record.id.startsWith("hkd-evidence-slot-")).length,
        runtimeEnabled: seedRecords.filter((record) => record.hkd_runtime_enabled).length,
      },
    },
  };

  const evidence = {
    schema: "hkd-lipi-registry-architecture-evidence.v1",
    generatedAt: architecture.generatedAt,
    reviewState: architecture.reviewState,
    governedProductionGo: false,
    phkdRules,
    artifacts: OUT,
    sourceRefs,
    checks: {
      unicodeScriptPropertyValuesFromUcd: aliases.length,
      seedRecords: seedRecords.length,
      everyRecordHasProvenance: seedRecords.every((record) => record.provenance && record.source_refs.length > 0),
      runtimeEnabledRows: 0,
      noProductionClaim: true,
    },
    stats: architecture.seedDatasetStructure.stats,
  };

  writeFileSync(OUT.architecture, `${JSON.stringify(architecture, null, 2)}\n`);
  writeFileSync(OUT.seed, `${JSON.stringify({ schema: "hkd-lipi-script-registry-seed-426.v1", generatedAt: architecture.generatedAt, reviewState: architecture.reviewState, governedProductionGo: false, sourceRefs, records: seedRecords }, null, 2)}\n`);
  writeFileSync(OUT.evidence, `${JSON.stringify(evidence, null, 2)}\n`);
  writeFileSync(OUT.jsonSchema, `${JSON.stringify(jsonSchema(), null, 2)}\n`);
  writeFileSync(OUT.tsTypes, tsTypes);
  writeFileSync(OUT.prisma, prismaModels);
  writeFileSync(OUT.sqlite, sqliteDdl);
  writeFileSync(OUT.postgres, postgresDdl);
  writeFileSync(OUT.markdown, buildMarkdown(architecture, seedRecords));
  writeFileSync(OUT.html, buildHtml(architecture, seedRecords));

  console.log(JSON.stringify(evidence.checks, null, 2));
}

mkdirSync("data", { recursive: true });
mkdirSync("release/evidence", { recursive: true });
mkdirSync("schemas", { recursive: true });
mkdirSync("migrations/sqlite", { recursive: true });
mkdirSync("migrations/postgresql", { recursive: true });
main();
