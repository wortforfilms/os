import { readFileSync, writeFileSync } from "node:fs";

const seed = JSON.parse(readFileSync("data/hkd-lipi-script-registry-seed-426.json", "utf8"));
const architecture = JSON.parse(readFileSync("data/hkd-lipi-registry-architecture.json", "utf8"));
const records = seed.records;

const apiContracts = [
  "GET /api/lipi-registry/scripts",
  "GET /api/lipi-registry/scripts/{id}",
  "GET /api/lipi-registry/unicode/crosswalk",
  "GET /api/lipi-registry/numerals-zero",
];

const rowsWithKnownZeroGlyph = records.filter((record) => record.zero_glyph !== "UNKNOWN").length;
const rowsWithDigitInventory = records.filter((record) => record.digits_0_9.length > 0).length;
const runtimeEnabledRows = records.filter((record) => record.hkd_runtime_enabled === true).length;
const nonUnicodeInventedAssignments = records.filter(
  (record) =>
    record.registry_class !== "unicode" &&
    (record.unicode_script_value !== "UNKNOWN" || record.unicode_script_alias !== "UNKNOWN" || record.iso15924 !== "UNKNOWN"),
);

const evidence = {
  schema: "hkd-lipi-registry-phase2-runtime-evidence.v1",
  generatedAt: new Date().toISOString(),
  reviewState: "CONTROLLED_NO_GO",
  governedProductionGo: false,
  productionReady: false,
  sourceOfTruth: {
    seed: "data/hkd-lipi-script-registry-seed-426.json",
    jsonSchema: "schemas/hkd-lipi-script-registry.schema.json",
    architecture: "data/hkd-lipi-registry-architecture.json",
  },
  runtimeIntegration: {
    uiRoutes: ["/lipi-registry", "/lipi-registry/{id}"],
    localApiContracts: apiContracts,
    unifiedSearchType: "lipi",
    detailPages: true,
    evidenceBadges: ["Evidence", "Unicode", "Runtime", "ISO 15924", "Sources"],
    numeralZeroView: true,
  },
  counts: {
    records: records.length,
    unicodeRows: records.filter((record) => record.registry_class === "unicode").length,
    runtimeEnabledRows,
    rowsWithKnownZeroGlyph,
    rowsWithDigitInventory,
    rowsWithUnknownZeroGlyph: records.length - rowsWithKnownZeroGlyph,
    architectureUnicodeScriptProperties: architecture.seedDatasetStructure.stats.unicodeScriptProperties,
  },
  phkdChecks: {
    everyRecordHasProvenance: records.every((record) => record.provenance && record.source_refs.length > 0),
    noProductionReadyRows: runtimeEnabledRows === 0,
    noInventedNonUnicodeAssignments: nonUnicodeInventedAssignments.length === 0,
    numeralViewDoesNotFillUnknownDigits: rowsWithKnownZeroGlyph === 0 && rowsWithDigitInventory === 0,
  },
  validation: {
    tests: [
      "node --experimental-strip-types --test tests/hkd-lipi-registry-runtime.test.ts",
      "node --test tests/hkd-lipi-registry-architecture.test.mjs",
      "npx tsc --noEmit",
    ],
  },
};

writeFileSync("release/evidence/hkd-lipi-registry-phase2-runtime.json", `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence.phkdChecks, null, 2));
