import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const UCD_DIR = "data/unicode/ucd-latest";
const SOURCE_PATHS = {
  propertyValueAliases: `${UCD_DIR}/PropertyValueAliases.txt`,
  scripts: `${UCD_DIR}/Scripts.txt`,
  blocks: `${UCD_DIR}/Blocks.txt`,
  unicodeData: `${UCD_DIR}/UnicodeData.txt`,
  readme: `${UCD_DIR}/ReadMe.txt`,
};

const OUT = {
  numeral: "data/hkd-lipi-numeral-registry.json",
  zero: "data/hkd-lipi-zero-registry.json",
  family: "data/hkd-lipi-script-family-graph.json",
  crosswalk: "data/hkd-lipi-unicode-crosswalk.json",
  evidence: "release/evidence/hkd-lipi-registry-phase3-enrichment.json",
};

const GENERATED_AT = new Date().toISOString();
const REVIEW_STATE = "CONTROLLED_NO_GO";
const GOVERNED_PRODUCTION_GO = false;
const PRODUCTION_READY = false;
const RUNTIME_ENABLED = 0;
const PHKD_VERDICT = "CONTROLLED_NO_GO";

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
  const [start, end = start] = rangeText.split("..");
  return [Number.parseInt(start, 16), Number.parseInt(end, 16)];
}

function codePointLabel(value) {
  return `U+${value.toString(16).toUpperCase().padStart(4, "0")}`;
}

function rangeLabel([start, end]) {
  return start === end ? codePointLabel(start) : `${codePointLabel(start)}-${codePointLabel(end)}`;
}

function intersects(a, b) {
  return a[0] <= b[1] && b[0] <= a[1];
}

function sourceRefs(extra = []) {
  return [
    "unicode-ucd-17-property-value-aliases",
    "unicode-ucd-17-scripts",
    "unicode-ucd-17-blocks",
    "unicode-ucd-17-unicode-data",
    ...extra,
  ].filter((value, index, all) => all.indexOf(value) === index);
}

function provenance(scope, refs = sourceRefs()) {
  return {
    scope,
    sourceIds: refs,
    generatedBy: "scripts/generate-hkd-lipi-registry-phase3-enrichment.mjs",
    sourcePolicy: "official_unicode_ucd_only",
    reviewed: false,
  };
}

function parseAliases() {
  return read(SOURCE_PATHS.propertyValueAliases)
    .split(/\r?\n/)
    .map(stripComment)
    .filter((line) => line.startsWith("sc"))
    .map((line) => {
      const parts = line.split(";").map((part) => part.trim()).filter(Boolean);
      return {
        alias: parts[1],
        value: parts[2],
        alternateAliases: parts.slice(3),
      };
    });
}

function parseScripts() {
  return read(SOURCE_PATHS.scripts)
    .split(/\r?\n/)
    .map(stripComment)
    .filter((line) => line.includes(";"))
    .map((line) => {
      const [rangeText, scriptValue] = line.split(";").map((part) => part.trim());
      return { range: parseRange(rangeText), scriptValue };
    })
    .sort((a, b) => a.range[0] - b.range[0]);
}

function parseBlocks() {
  return read(SOURCE_PATHS.blocks)
    .split(/\r?\n/)
    .map(stripComment)
    .filter((line) => line.includes(";"))
    .map((line) => {
      const [rangeText, blockName] = line.split(";").map((part) => part.trim());
      const range = parseRange(rangeText);
      return {
        blockName,
        range,
        rangeLabel: rangeLabel(range),
        start: codePointLabel(range[0]),
        end: codePointLabel(range[1]),
      };
    })
    .sort((a, b) => a.range[0] - b.range[0]);
}

function parseUnicodeData() {
  return read(SOURCE_PATHS.unicodeData)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const fields = line.split(";");
      return {
        codePoint: Number.parseInt(fields[0], 16),
        codePointLabel: codePointLabel(Number.parseInt(fields[0], 16)),
        name: fields[1],
        generalCategory: fields[2],
        decimalValue: fields[6] === "" ? null : Number.parseInt(fields[6], 10),
        digitValue: fields[7] === "" ? null : Number.parseInt(fields[7], 10),
        numericValue: fields[8] || null,
        glyph: String.fromCodePoint(Number.parseInt(fields[0], 16)),
      };
    });
}

function findScriptForCodePoint(scripts, codePoint) {
  let low = 0;
  let high = scripts.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = scripts[mid];
    if (codePoint < candidate.range[0]) {
      high = mid - 1;
    } else if (codePoint > candidate.range[1]) {
      low = mid + 1;
    } else {
      return candidate.scriptValue;
    }
  }
  return "Unknown";
}

function findBlockForCodePoint(blocks, codePoint) {
  let low = 0;
  let high = blocks.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = blocks[mid];
    if (codePoint < candidate.range[0]) {
      high = mid - 1;
    } else if (codePoint > candidate.range[1]) {
      low = mid + 1;
    } else {
      return candidate;
    }
  }
  return null;
}

function groupScriptRanges(scripts) {
  const byScript = new Map();
  for (const row of scripts) {
    if (!byScript.has(row.scriptValue)) byScript.set(row.scriptValue, []);
    byScript.get(row.scriptValue).push(row.range);
  }
  return byScript;
}

function blockMetadataForRanges(blocks, ranges) {
  const found = blocks.filter((block) => ranges.some((range) => intersects(block.range, range)));
  return found.map((block) => ({
    blockName: block.blockName,
    range: block.rangeLabel,
    start: block.start,
    end: block.end,
    provenance: provenance("unicode_block_metadata", ["unicode-ucd-17-blocks"]),
  }));
}

function compactDigitSet(scriptValue, digits) {
  const byValue = new Map();
  for (const digit of digits) {
    if (!byValue.has(digit.decimalValue)) byValue.set(digit.decimalValue, []);
    byValue.get(digit.decimalValue).push(digit);
  }
  const digits_0_9 = Array.from({ length: 10 }, (_, value) => byValue.get(value)?.[0] ?? null);
  const allValuesPresent = digits_0_9.every(Boolean);
  return {
    scriptValue,
    digits_0_9: digits_0_9.map((digit) => ({
      value: digit.decimalValue,
      glyph: digit.glyph,
      codePoint: digit.codePointLabel,
      name: digit.name,
      blockName: digit.blockName,
    })),
    allDecimalDigits: Object.fromEntries(
      Array.from(byValue.entries()).map(([value, valueDigits]) => [
        String(value),
        valueDigits.map((digit) => ({
          glyph: digit.glyph,
          codePoint: digit.codePointLabel,
          name: digit.name,
          blockName: digit.blockName,
        })),
      ]),
    ),
    allValuesPresent,
    zeroGlyph: digits_0_9[0]?.glyph ?? "UNKNOWN",
    zeroCodePoint: digits_0_9[0]?.codePointLabel ?? "UNKNOWN",
    sourceRefs: sourceRefs(),
    provenance: provenance("decimal_digit_inventory"),
  };
}

function main() {
  const aliases = parseAliases();
  const aliasByScript = new Map(aliases.map((entry) => [entry.value, entry]));
  const scripts = parseScripts();
  const blocks = parseBlocks();
  const unicodeData = parseUnicodeData();
  const rangesByScript = groupScriptRanges(scripts);
  const sourceFiles = Object.entries(SOURCE_PATHS).map(([id, path]) => ({ id, path, sha256: sha256(path) }));

  const decimalDigits = unicodeData
    .filter((row) => row.generalCategory === "Nd" && row.decimalValue !== null)
    .map((row) => {
      const block = findBlockForCodePoint(blocks, row.codePoint);
      return {
        ...row,
        scriptValue: findScriptForCodePoint(scripts, row.codePoint),
        blockName: block?.blockName ?? "UNKNOWN",
        blockRange: block?.rangeLabel ?? "UNKNOWN",
      };
    });

  const decimalDigitsByScript = new Map();
  for (const digit of decimalDigits) {
    if (!decimalDigitsByScript.has(digit.scriptValue)) decimalDigitsByScript.set(digit.scriptValue, []);
    decimalDigitsByScript.get(digit.scriptValue).push(digit);
  }

  const numeralEntries = Array.from(decimalDigitsByScript.entries())
    .map(([scriptValue, digits]) => compactDigitSet(scriptValue, digits))
    .sort((a, b) => a.scriptValue.localeCompare(b.scriptValue));

  const numeralRegistry = {
    schema: "hkd-lipi-numeral-registry.v1",
    generatedAt: GENERATED_AT,
    reviewState: REVIEW_STATE,
    governedProductionGo: GOVERNED_PRODUCTION_GO,
    productionReady: PRODUCTION_READY,
    runtimeEnabled: RUNTIME_ENABLED,
    phkdVerdict: PHKD_VERDICT,
    sourcePolicy: "official_unicode_ucd_only",
    sourceFiles,
    summary: {
      decimalScriptCount: numeralEntries.length,
      decimalDigitCodePointCount: decimalDigits.length,
      completeDigitSetScripts: numeralEntries.filter((entry) => entry.allValuesPresent).length,
      incompleteDigitSetScripts: numeralEntries.filter((entry) => !entry.allValuesPresent).map((entry) => entry.scriptValue),
    },
    records: numeralEntries,
  };

  const zeroRegistry = {
    schema: "hkd-lipi-zero-registry.v1",
    generatedAt: GENERATED_AT,
    reviewState: REVIEW_STATE,
    governedProductionGo: GOVERNED_PRODUCTION_GO,
    productionReady: PRODUCTION_READY,
    runtimeEnabled: RUNTIME_ENABLED,
    phkdVerdict: PHKD_VERDICT,
    sourcePolicy: "official_unicode_ucd_only",
    sourceFiles,
    summary: {
      zeroGlyphScripts: numeralEntries.filter((entry) => entry.zeroGlyph !== "UNKNOWN").length,
      missingZeroGlyphScripts: numeralEntries.filter((entry) => entry.zeroGlyph === "UNKNOWN").map((entry) => entry.scriptValue),
    },
    records: numeralEntries.map((entry) => ({
      scriptValue: entry.scriptValue,
      zeroGlyph: entry.zeroGlyph,
      zeroCodePoint: entry.zeroCodePoint,
      sourceRefs: entry.sourceRefs,
      provenance: provenance("zero_glyph_registry"),
    })),
  };

  const crosswalkRows = aliases.map((entry) => {
    const ranges = rangesByScript.get(entry.value) ?? [];
    const blockMetadata = blockMetadataForRanges(blocks, ranges);
    const numeral = numeralEntries.find((candidate) => candidate.scriptValue === entry.value);
    return {
      unicodeScriptValue: entry.value,
      unicodeScriptAlias: entry.alias,
      iso15924: entry.alias,
      alternateAliases: entry.alternateAliases,
      scriptPropertyKind: entry.value === "Common" ? "common" : entry.value === "Inherited" ? "inherited" : entry.value === "Unknown" ? "unknown" : "explicit",
      unicodeRanges: ranges.map(rangeLabel),
      unicodeBlocks: blockMetadata,
      decimalDigits: numeral
        ? {
            digits_0_9: numeral.digits_0_9,
            zeroGlyph: numeral.zeroGlyph,
            zeroCodePoint: numeral.zeroCodePoint,
          }
        : {
            digits_0_9: [],
            zeroGlyph: "UNKNOWN",
            zeroCodePoint: "UNKNOWN",
          },
      transliterationMetadata: {
        status: "UNKNOWN",
        systems: [],
        blockedReason: "Unicode UCD does not define transliteration systems.",
        provenance: provenance("transliteration_metadata_limit", sourceRefs()),
      },
      fontSupportMetadata: {
        status: "UNKNOWN",
        recommendedFonts: [],
        blockedReason: "Unicode UCD does not define font support or recommended fonts.",
        provenance: provenance("font_support_metadata_limit", sourceRefs()),
      },
      sourceRefs: sourceRefs(),
      provenance: provenance("unicode_crosswalk"),
    };
  });

  const crosswalk = {
    schema: "hkd-lipi-unicode-crosswalk.v1",
    generatedAt: GENERATED_AT,
    reviewState: REVIEW_STATE,
    governedProductionGo: GOVERNED_PRODUCTION_GO,
    productionReady: PRODUCTION_READY,
    runtimeEnabled: RUNTIME_ENABLED,
    phkdVerdict: PHKD_VERDICT,
    sourcePolicy: "official_unicode_ucd_only",
    sourceFiles,
    summary: {
      unicodeScriptValues: crosswalkRows.length,
      rowsWithRanges: crosswalkRows.filter((row) => row.unicodeRanges.length > 0).length,
      rowsWithDecimalDigits: crosswalkRows.filter((row) => row.decimalDigits.digits_0_9.length > 0).length,
      rowsWithFontSupportMetadata: crosswalkRows.length,
      rowsWithTransliterationMetadata: crosswalkRows.length,
      fontSupportKnownRows: 0,
      transliterationKnownRows: 0,
    },
    records: crosswalkRows,
  };

  const familyNodes = aliases.map((entry) => ({
    id: `script:${entry.value}`,
    unicodeScriptValue: entry.value,
    unicodeScriptAlias: entry.alias,
    displayName: entry.value.replace(/_/g, " "),
    familyStatus: "UNKNOWN",
    provenance: provenance("script_family_node", ["unicode-ucd-17-property-value-aliases"]),
  }));

  const blockEdges = crosswalkRows.flatMap((row) =>
    row.unicodeBlocks.map((block) => ({
      from: `script:${row.unicodeScriptValue}`,
      to: `block:${block.blockName}`,
      relation: "HAS_UNICODE_BLOCK",
      evidenceStatus: "verified",
      sourceRefs: ["unicode-ucd-17-scripts", "unicode-ucd-17-blocks"],
      provenance: provenance("script_to_block_relationship", ["unicode-ucd-17-scripts", "unicode-ucd-17-blocks"]),
    })),
  );

  const blockNodes = Array.from(new Set(blockEdges.map((edge) => edge.to))).map((id) => {
    const blockName = id.replace("block:", "");
    const block = blocks.find((candidate) => candidate.blockName === blockName);
    return {
      id,
      blockName,
      range: block?.rangeLabel ?? "UNKNOWN",
      provenance: provenance("unicode_block_node", ["unicode-ucd-17-blocks"]),
    };
  });

  const familyGraph = {
    schema: "hkd-lipi-script-family-graph.v1",
    generatedAt: GENERATED_AT,
    reviewState: REVIEW_STATE,
    governedProductionGo: GOVERNED_PRODUCTION_GO,
    productionReady: PRODUCTION_READY,
    runtimeEnabled: RUNTIME_ENABLED,
    phkdVerdict: PHKD_VERDICT,
    sourcePolicy: "official_unicode_ucd_only",
    sourceFiles,
    summary: {
      scriptNodes: familyNodes.length,
      blockNodes: blockNodes.length,
      verifiedScriptBlockEdges: blockEdges.length,
      genealogicalFamilyEdges: 0,
      blockedReason: "Unicode UCD defines Script properties and blocks, not genealogical script-family descent.",
    },
    nodes: {
      scripts: familyNodes,
      blocks: blockNodes,
    },
    edges: {
      scriptBlockEdges: blockEdges,
      genealogicalFamilyEdges: [],
      blockedGenealogicalFamilyRelationships: aliases.map((entry) => ({
        unicodeScriptValue: entry.value,
        familyStatus: "UNKNOWN",
        blockedReason: "No genealogical relationship is asserted because it is not present in official Unicode UCD data.",
        provenance: provenance("blocked_genealogical_family_relationship", ["unicode-ucd-17-property-value-aliases"]),
      })),
    },
  };

  const evidence = {
    schema: "hkd-lipi-registry-phase3-enrichment-evidence.v1",
    generatedAt: GENERATED_AT,
    reviewState: REVIEW_STATE,
    governedProductionGo: GOVERNED_PRODUCTION_GO,
    productionReady: PRODUCTION_READY,
    runtimeEnabled: RUNTIME_ENABLED,
    phkdVerdict: PHKD_VERDICT,
    sourcePolicy: "official_unicode_ucd_only",
    artifacts: OUT,
    sourceFiles,
    checks: {
      decimalScriptCount: numeralRegistry.summary.decimalScriptCount,
      everyUnicodeDecimalScriptHasDigits0To9: numeralEntries.every((entry) => entry.allValuesPresent),
      everyDecimalScriptHasZeroGlyph: zeroRegistry.records.every((entry) => entry.zeroGlyph !== "UNKNOWN"),
      noInventedIso15924Codes: crosswalk.records.every((entry) => aliasByScript.get(entry.unicodeScriptValue)?.alias === entry.iso15924),
      noInventedUnicodeRanges: crosswalk.records.every((entry) => entry.unicodeRanges.every((range) => (rangesByScript.get(entry.unicodeScriptValue) ?? []).map(rangeLabel).includes(range))),
      everyEnrichmentHasProvenance:
        numeralRegistry.records.every((entry) => entry.provenance) &&
        zeroRegistry.records.every((entry) => entry.provenance) &&
        crosswalk.records.every((entry) => entry.provenance && entry.fontSupportMetadata.provenance && entry.transliterationMetadata.provenance) &&
        familyGraph.nodes.scripts.every((entry) => entry.provenance) &&
        familyGraph.edges.scriptBlockEdges.every((entry) => entry.provenance),
      fontSupportKnownRows: 0,
      transliterationKnownRows: 0,
    },
    limitations: [
      "Font support metadata is intentionally UNKNOWN because Unicode UCD does not define fonts.",
      "Transliteration metadata is intentionally UNKNOWN because Unicode UCD does not define transliteration systems.",
      "Genealogical family edges are intentionally empty because Unicode UCD does not define descent relationships.",
    ],
  };

  writeFileSync(OUT.numeral, `${JSON.stringify(numeralRegistry, null, 2)}\n`);
  writeFileSync(OUT.zero, `${JSON.stringify(zeroRegistry, null, 2)}\n`);
  writeFileSync(OUT.family, `${JSON.stringify(familyGraph, null, 2)}\n`);
  writeFileSync(OUT.crosswalk, `${JSON.stringify(crosswalk, null, 2)}\n`);
  writeFileSync(OUT.evidence, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence.checks, null, 2));
}

main();
