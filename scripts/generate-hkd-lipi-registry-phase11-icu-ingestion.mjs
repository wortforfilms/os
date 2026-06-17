import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const ICU_COMMIT = "f23381d83cdd98199247adafc85851ce9c2e143f";

const INPUTS = {
  seed: "data/hkd-lipi-script-registry-seed-426.json",
  unicodeCrosswalk: "data/hkd-lipi-unicode-crosswalk.json",
  iso15924Crosswalk: "data/iso15924-script-code-crosswalk.json",
  cldrCrosswalk: "data/cldr-script-locale-crosswalk.json",
  icuScriptHeader: "data/icu/uscript.h",
  icuScriptProps: "data/icu/uscript_props.cpp",
};

const OUT = {
  report: "data/icu-ingestion-report.json",
  crosswalk: "data/icu-script-metadata-crosswalk.json",
  diffPreview: "data/icu-diff-preview.json",
  blockers: "data/icu-blockers.json",
  evidence: "release/evidence/hkd-lipi-registry-phase11-icu-ingestion.json",
};

const GENERATED_AT = "DETERMINISTIC_FROM_OFFICIAL_ICU_USCRIPT_SNAPSHOT";
const GENERATED_BY = "scripts/generate-hkd-lipi-registry-phase11-icu-ingestion.mjs";
const REVIEW_STATE = "CONTROLLED_NO_GO";
const PHKD_VERDICT = "CONTROLLED_NO_GO";
const GOVERNED_PRODUCTION_GO = false;
const PRODUCTION_READY = false;
const RUNTIME_ENABLED = 0;
const SOURCE_POLICY = "icu_official_uscript_source_only_script_metadata_no_registry_mutation";
const OFFICIAL_SOURCE_ID = "icu-official-uscript-source";
const OFFICIAL_SOURCE_PAGE = "https://github.com/unicode-org/icu";
const OFFICIAL_HEADER_URL = `https://raw.githubusercontent.com/unicode-org/icu/${ICU_COMMIT}/icu4c/source/common/unicode/uscript.h`;
const OFFICIAL_PROPS_URL = `https://raw.githubusercontent.com/unicode-org/icu/${ICU_COMMIT}/icu4c/source/common/uscript_props.cpp`;

function read(path) {
  return readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

function sha256(pathOrBuffer) {
  const input = Buffer.isBuffer(pathOrBuffer) ? pathOrBuffer : readFileSync(pathOrBuffer);
  return createHash("sha256").update(input).digest("hex");
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function slug(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function normalizeName(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function titleFromConstant(constant) {
  return constant
    .split("_")
    .map((part) => (part ? part[0] + part.slice(1).toLowerCase() : part))
    .join("_");
}

function provenance(scope, sourceIds = [OFFICIAL_SOURCE_ID], inputPaths = Object.values(INPUTS)) {
  return {
    scope,
    sourceIds: unique(sourceIds),
    generatedBy: GENERATED_BY,
    sourcePolicy: SOURCE_POLICY,
    officialSourceUrls: [OFFICIAL_HEADER_URL, OFFICIAL_PROPS_URL],
    trustedInputs: unique(inputPaths),
    reviewed: false,
    phkd: "ICU_USCRIPT_METADATA_ONLY_NO_GENEALOGY_NO_FONT_NO_RENDERING_NO_LOCALE_INFERENCE",
  };
}

function baseArtifact(schema, extra = {}) {
  return {
    schema,
    generatedAt: GENERATED_AT,
    reviewState: REVIEW_STATE,
    governedProductionGo: GOVERNED_PRODUCTION_GO,
    productionReady: PRODUCTION_READY,
    runtimeEnabled: RUNTIME_ENABLED,
    phkdVerdict: PHKD_VERDICT,
    sourcePolicy: SOURCE_POLICY,
    officialSource: {
      id: OFFICIAL_SOURCE_ID,
      sourcePage: OFFICIAL_SOURCE_PAGE,
      commit: ICU_COMMIT,
      files: [
        {
          role: "ICU UScriptCode constants and short-name comments",
          url: OFFICIAL_HEADER_URL,
          localPath: INPUTS.icuScriptHeader,
          sha256: sha256(INPUTS.icuScriptHeader),
        },
        {
          role: "ICU script metadata source; flags are not ingested in Phase 11",
          url: OFFICIAL_PROPS_URL,
          localPath: INPUTS.icuScriptProps,
          sha256: sha256(INPUTS.icuScriptProps),
        },
      ],
      note: "Phase 11 reads only ICU UScriptCode enum code/name/short-code metadata and source coverage; it does not ingest ICU locale inference, genealogy, rendering, fonts, normalization, collation, or shaping behavior.",
    },
    trustedInputs: Object.entries(INPUTS).map(([id, path]) => ({ id, path, sha256: sha256(path) })),
    provenance: provenance(schema),
    ...extra,
  };
}

function parseIcuScriptCodes(header) {
  const rows = [];
  const aliasConstants = [];
  for (const line of header.split(/\r?\n/)) {
    const direct = line.match(/USCRIPT_([A-Z0-9_]+)\s*=\s*(-?\d+)\s*,\s*\/\*\s*([A-Za-z0-9]{4})\s*\*\//);
    if (direct) {
      rows.push({
        constant: `USCRIPT_${direct[1]}`,
        constantName: direct[1],
        numericCode: Number(direct[2]),
        shortName: direct[3],
        nameFromConstant: titleFromConstant(direct[1]),
        sourceLine: line.trim(),
      });
      continue;
    }
    const alias = line.match(/USCRIPT_([A-Z0-9_]+)\s*=\s*USCRIPT_([A-Z0-9_]+)\s*,/);
    if (alias) {
      aliasConstants.push({
        constant: `USCRIPT_${alias[1]}`,
        targetConstant: `USCRIPT_${alias[2]}`,
        sourceLine: line.trim(),
      });
    }
  }
  return { rows: rows.filter((row) => row.numericCode >= 0), aliasConstants };
}

function parseIcuScriptPropsAliases(source) {
  const body = source.match(/const int32_t SCRIPT_PROPS\[\] = \{([\s\S]*?)\n\};/)?.[1] ?? "";
  return body
    .split(/\r?\n/)
    .map((line, index) => {
      const alias = line.match(/\/\/\s*([A-Za-z0-9]{4})\s*$/)?.[1] ?? "UNKNOWN";
      return {
        index,
        shortName: alias,
        hasExplicitComment: alias !== "UNKNOWN",
        sourceLine: line.trim(),
      };
    })
    .filter((row) => row.sourceLine && !row.sourceLine.startsWith("//"));
}

function makeCrosswalkRow(unicodeRow, icuByShortName, isoByScriptValue, cldrByAlias) {
  const icu = icuByShortName.get(unicodeRow.unicodeScriptAlias) ?? null;
  const iso = isoByScriptValue.get(unicodeRow.unicodeScriptValue) ?? null;
  const cldr = cldrByAlias.get(unicodeRow.unicodeScriptAlias) ?? null;
  const blockers = [];
  if (!icu) blockers.push("ICU_SCRIPT_CODE_MISSING");
  if (icu && icu.shortName !== unicodeRow.unicodeScriptAlias) blockers.push("ICU_SHORT_NAME_MISMATCH");
  if (icu && normalizeName(icu.constantName) !== normalizeName(unicodeRow.unicodeScriptValue)) blockers.push("ICU_CONSTANT_NAME_DIFFERS_FROM_UCD_CANONICAL_VALUE");
  if (iso?.status === "BLOCKED") blockers.push("ISO15924_ROW_BLOCKED");
  if (cldr?.status === "BLOCKED") blockers.push("CLDR_ROW_BLOCKED");

  const status = blockers.length ? "BLOCKED" : icu ? "VERIFIED" : "UNKNOWN";
  return {
    id: `phase11:icu-script-metadata:${slug(unicodeRow.unicodeScriptValue)}`,
    unicodeScriptValue: unicodeRow.unicodeScriptValue,
    unicodeScriptAlias: unicodeRow.unicodeScriptAlias,
    iso15924: unicodeRow.iso15924,
    icuConstant: icu?.constant ?? "UNKNOWN",
    icuNumericCode: icu?.numericCode ?? "UNKNOWN",
    icuShortName: icu?.shortName ?? "UNKNOWN",
    icuNameFromConstant: icu?.nameFromConstant ?? "UNKNOWN",
    status,
    blockers,
    sourceBacked: Boolean(icu),
    codeMatchWithUcd: Boolean(icu && icu.shortName === unicodeRow.unicodeScriptAlias),
    canonicalNameMatchesUcd: Boolean(icu && normalizeName(icu.constantName) === normalizeName(unicodeRow.unicodeScriptValue)),
    iso15924Status: iso?.status ?? "UNKNOWN",
    cldrStatus: cldr?.status ?? "UNKNOWN",
    localeInferenceClaim: "NOT_ASSERTED",
    genealogyClaim: "NOT_ASSERTED",
    fontClaim: "NOT_ASSERTED",
    renderingClaim: "NOT_ASSERTED",
    previewOnly: true,
    wouldMutateRegistry: false,
    wouldEnrichRow: false,
    wouldEnableRuntime: false,
    provenance: provenance("icu_script_metadata_crosswalk_row"),
  };
}

function makeDiff(row) {
  return {
    id: `phase11:diff:${slug(row.unicodeScriptValue)}`,
    unicodeScriptValue: row.unicodeScriptValue,
    unicodeScriptAlias: row.unicodeScriptAlias,
    status: row.status,
    diffKind: row.status === "VERIFIED" ? "ICU_METADATA_MATCH_PREVIEW_ONLY" : "ICU_METADATA_BLOCKED_PREVIEW_ONLY",
    proposedFieldChange: false,
    proposedRegistryPatch: [],
    previewOnly: true,
    wouldMutateRegistry: false,
    wouldEnrichRow: false,
    wouldEnableRuntime: false,
    reason:
      row.status === "VERIFIED"
        ? "ICU script code and enum metadata match the UCD/registry alias; no registry change is proposed."
        : `ICU metadata comparison is blocked: ${row.blockers.join(", ")}.`,
    provenance: provenance("icu_diff_preview_row"),
  };
}

function makeRowBlocker(row) {
  return {
    id: `phase11:blocker:ucd-row:${slug(row.unicodeScriptValue)}`,
    blockerClass: "UCD_ROW_METADATA_MISMATCH",
    unicodeScriptValue: row.unicodeScriptValue,
    unicodeScriptAlias: row.unicodeScriptAlias,
    icuConstant: row.icuConstant,
    icuShortName: row.icuShortName,
    status: "BLOCKED",
    severity: row.blockers.includes("ISO15924_ROW_BLOCKED") ? "HIGH" : "MEDIUM",
    blocksPromotion: true,
    blockers: row.blockers,
    reason: `ICU metadata for ${row.unicodeScriptValue} cannot be promoted until ${row.blockers.join(", ")} is resolved.`,
    requiredToUnblock: ["review ICU/UCD/ISO source disagreement", "attach explicit mapping policy", "rerun ICU dry ingestion"],
    provenance: provenance("icu_ucd_row_metadata_blocker"),
  };
}

function makeExtraIcuBlocker(icu, hasIsoCode, hasCldrExplicitLink) {
  const blockers = ["ICU_CODE_NOT_UCD_SCRIPT_PROPERTY_ROW"];
  if (!hasIsoCode) blockers.push("ICU_CODE_NOT_FOUND_IN_ISO15924");
  if (hasCldrExplicitLink) blockers.push("ICU_CODE_APPEARS_IN_CLDR_BUT_NOT_UCD");
  return {
    id: `phase11:blocker:extra-icu-code:${slug(icu.shortName)}`,
    blockerClass: "ICU_EXTRA_NON_UCD_SCRIPT_CODE",
    icuConstant: icu.constant,
    icuNumericCode: icu.numericCode,
    icuShortName: icu.shortName,
    icuNameFromConstant: icu.nameFromConstant,
    status: "BLOCKED",
    severity: hasCldrExplicitLink ? "HIGH" : "MEDIUM",
    blocksPromotion: true,
    blockers,
    iso15924CodePresent: hasIsoCode,
    cldrExplicitLinkPresent: hasCldrExplicitLink,
    localeInferenceClaim: "NOT_ASSERTED",
    genealogyClaim: "NOT_ASSERTED",
    fontClaim: "NOT_ASSERTED",
    renderingClaim: "NOT_ASSERTED",
    reason: `ICU code ${icu.shortName} is present in ICU but is not a UCD Script property row in the 176-row registry; no registry merge is allowed.`,
    requiredToUnblock: ["classify as non-UCD ICU/ISO code", "attach explicit policy if a future registry partition should store it", "rerun ICU dry ingestion"],
    provenance: provenance("icu_extra_non_ucd_code_blocker"),
  };
}

function countBy(items, selectKey) {
  return items.reduce((acc, item) => {
    const key = selectKey(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function main() {
  const seedHashBefore = sha256(INPUTS.seed);
  const seed = readJson(INPUTS.seed);
  const unicodeCrosswalk = readJson(INPUTS.unicodeCrosswalk);
  const isoCrosswalk = readJson(INPUTS.iso15924Crosswalk);
  const cldrCrosswalk = readJson(INPUTS.cldrCrosswalk);
  const { rows: icuRows, aliasConstants } = parseIcuScriptCodes(read(INPUTS.icuScriptHeader));
  const scriptPropsRows = parseIcuScriptPropsAliases(read(INPUTS.icuScriptProps));
  const icuByShortName = new Map(icuRows.map((row) => [row.shortName, row]));
  const isoByScriptValue = new Map(isoCrosswalk.rows.map((row) => [row.unicodeScriptValue, row]));
  const isoCodes = new Set(isoCrosswalk.rows.map((row) => row.officialIso15924 ?? row.unicodeScriptAlias));
  const cldrByAlias = new Map(cldrCrosswalk.rows.map((row) => [row.unicodeScriptAlias, row]));
  const cldrExplicitCodes = new Set([
    ...(cldrCrosswalk.cldrScriptCodes ?? []),
    ...(cldrCrosswalk.unmatchedCldrScripts ?? []),
  ]);
  const registryAliases = new Set(unicodeCrosswalk.records.map((row) => row.unicodeScriptAlias));
  const crosswalkRows = unicodeCrosswalk.records.map((row) => makeCrosswalkRow(row, icuByShortName, isoByScriptValue, cldrByAlias));
  const extraIcuRows = icuRows.filter((row) => !registryAliases.has(row.shortName));
  const diffRows = crosswalkRows.map(makeDiff);
  const rowBlockers = crosswalkRows.filter((row) => row.status === "BLOCKED").map(makeRowBlocker);
  const extraBlockers = extraIcuRows.map((row) => makeExtraIcuBlocker(row, isoCodes.has(row.shortName), cldrExplicitCodes.has(row.shortName)));
  const blockerRows = [...rowBlockers, ...extraBlockers];
  const statuses = countBy(crosswalkRows, (row) => row.status);

  const crosswalk = baseArtifact("icu-script-metadata-crosswalk.v1", {
    summary: {
      unicodeScriptRowsCompared: crosswalkRows.length,
      officialIcuScriptCodes: icuRows.length,
      officialIcuAliasConstants: aliasConstants.length,
      icuScriptPropsRows: scriptPropsRows.length,
      verifiedRows: statuses.VERIFIED ?? 0,
      unknownRows: statuses.UNKNOWN ?? 0,
      blockedRows: statuses.BLOCKED ?? 0,
      ucdRowsMissingIcuCode: crosswalkRows.filter((row) => row.blockers.includes("ICU_SCRIPT_CODE_MISSING")).length,
      canonicalNameMismatches: crosswalkRows.filter((row) => row.blockers.includes("ICU_CONSTANT_NAME_DIFFERS_FROM_UCD_CANONICAL_VALUE")).length,
      isoBlockedRows: crosswalkRows.filter((row) => row.blockers.includes("ISO15924_ROW_BLOCKED")).length,
      cldrBlockedRows: crosswalkRows.filter((row) => row.blockers.includes("CLDR_ROW_BLOCKED")).length,
      extraIcuCodesNotInUcdRegistry: extraIcuRows.length,
      previewOnlyRows: crosswalkRows.filter((row) => row.previewOnly).length,
      registryMutations: crosswalkRows.filter((row) => row.wouldMutateRegistry).length,
      enrichedRows: crosswalkRows.filter((row) => row.wouldEnrichRow).length,
      runtimeEnablements: crosswalkRows.filter((row) => row.wouldEnableRuntime).length,
    },
    icuAliasConstants: aliasConstants,
    extraIcuCodesNotInUcdRegistry: extraIcuRows,
    rows: crosswalkRows,
  });

  const diffPreview = baseArtifact("icu-diff-preview.v1", {
    summary: {
      diffs: diffRows.length,
      metadataMatchPreviews: diffRows.filter((row) => row.diffKind === "ICU_METADATA_MATCH_PREVIEW_ONLY").length,
      blockedMetadataPreviews: diffRows.filter((row) => row.diffKind === "ICU_METADATA_BLOCKED_PREVIEW_ONLY").length,
      proposedFieldChanges: diffRows.filter((row) => row.proposedFieldChange).length,
      previewOnlyRows: diffRows.filter((row) => row.previewOnly).length,
      registryMutations: diffRows.filter((row) => row.wouldMutateRegistry).length,
      enrichedRows: diffRows.filter((row) => row.wouldEnrichRow).length,
      runtimeEnablements: diffRows.filter((row) => row.wouldEnableRuntime).length,
    },
    diffs: diffRows,
  });

  const blockers = baseArtifact("icu-blockers.v1", {
    summary: {
      blockers: blockerRows.length,
      ucdRowMetadataMismatches: rowBlockers.length,
      extraIcuCodesNotInUcdRegistry: extraBlockers.length,
      canonicalNameMismatches: rowBlockers.filter((row) => row.blockers.includes("ICU_CONSTANT_NAME_DIFFERS_FROM_UCD_CANONICAL_VALUE")).length,
      isoBlockedRows: rowBlockers.filter((row) => row.blockers.includes("ISO15924_ROW_BLOCKED")).length,
      highSeverity: blockerRows.filter((row) => row.severity === "HIGH").length,
      promotionBlocked: blockerRows.some((row) => row.blocksPromotion),
    },
    mismatchPromotionPolicy: {
      rule: "ANY_ICU_UCD_ISO_CLDR_METADATA_MISMATCH_BLOCKS_PROMOTION",
      promotionAllowedWhenMismatch: false,
      enforced: true,
      mismatchesDetected: blockerRows.length,
    },
    blockers: blockerRows,
  });

  const report = baseArtifact("icu-ingestion-report.v1", {
    ingestion: {
      mode: "ICU_USCRIPT_METADATA_DRY_RUN_ONLY",
      adapter: "icu",
      officialIcuScriptCodes: icuRows.length,
      officialIcuAliasConstants: aliasConstants.length,
      icuScriptPropsRows: scriptPropsRows.length,
      unicodeScriptRowsCompared: crosswalkRows.length,
      rowsWritten: 0,
      enrichedRows: 0,
      runtimeEnablements: 0,
      proposedFieldChanges: 0,
      blockers: blockerRows.length,
      promotionStatus: blockerRows.length ? "BLOCKED" : "REVIEW_ONLY",
      mismatchesBlockPromotion: true,
      seedHashBefore,
      seedHashAfter: sha256(INPUTS.seed),
    },
    summary: {
      verifiedRows: crosswalk.summary.verifiedRows,
      unknownRows: crosswalk.summary.unknownRows,
      blockedRows: crosswalk.summary.blockedRows,
      extraIcuCodesNotInUcdRegistry: crosswalk.summary.extraIcuCodesNotInUcdRegistry,
      canonicalNameMismatches: crosswalk.summary.canonicalNameMismatches,
      isoBlockedRows: crosswalk.summary.isoBlockedRows,
    },
  });

  const allRowsHaveNoClaims = crosswalkRows.every(
    (row) =>
      row.localeInferenceClaim === "NOT_ASSERTED" &&
      row.genealogyClaim === "NOT_ASSERTED" &&
      row.fontClaim === "NOT_ASSERTED" &&
      row.renderingClaim === "NOT_ASSERTED",
  );
  const checks = {
    officialIcuSourceOnly: true,
    comparedExactly176UnicodeRows: crosswalkRows.length === 176,
    everyUnicodeRowHasIcuCode: crosswalkRows.every((row) => row.icuShortName !== "UNKNOWN"),
    noRegistryMutation: report.ingestion.rowsWritten === 0 && report.ingestion.seedHashBefore === report.ingestion.seedHashAfter,
    previewOnlyDiffs: diffRows.every((row) => row.previewOnly && !row.wouldMutateRegistry && !row.wouldEnrichRow && !row.wouldEnableRuntime),
    noEnrichedRows: report.ingestion.enrichedRows === 0,
    noRuntimeEnablement: report.ingestion.runtimeEnablements === 0 && seed.records.every((record) => record.hkd_runtime_enabled === false),
    noProductionReadyTrue: !report.productionReady && !crosswalk.productionReady && !diffPreview.productionReady && !blockers.productionReady,
    noLocaleInferenceClaims: allRowsHaveNoClaims,
    noGenealogyClaims: allRowsHaveNoClaims,
    noFontClaims: allRowsHaveNoClaims,
    noRenderingClaims: allRowsHaveNoClaims,
    mismatchesBlocked: blockerRows.every((row) => row.status === "BLOCKED" && row.blocksPromotion),
    allOutputsHaveProvenance: [report, crosswalk, diffPreview, blockers].every((artifact) => artifact.provenance?.sourceIds?.includes(OFFICIAL_SOURCE_ID)),
  };

  const evidence = baseArtifact("hkd-lipi-registry-phase11-icu-ingestion.v1", {
    counts: {
      officialIcuScriptCodes: icuRows.length,
      officialIcuAliasConstants: aliasConstants.length,
      icuScriptPropsRows: scriptPropsRows.length,
      unicodeScriptRowsCompared: crosswalkRows.length,
      verifiedRows: crosswalk.summary.verifiedRows,
      unknownRows: crosswalk.summary.unknownRows,
      blockedRows: crosswalk.summary.blockedRows,
      blockers: blockerRows.length,
      extraIcuCodesNotInUcdRegistry: extraIcuRows.length,
      canonicalNameMismatches: crosswalk.summary.canonicalNameMismatches,
      isoBlockedRows: crosswalk.summary.isoBlockedRows,
      proposedFieldChanges: 0,
      rowsWritten: 0,
      enrichedRows: 0,
      runtimeEnablements: 0,
    },
    checks,
    outputs: OUT,
    limitations: [
      "ICU is used only for UScriptCode script-code/name/canonical metadata checks.",
      "ICU script metadata flags from uscript_props.cpp are source-covered but not ingested as registry facts in Phase 11.",
      "No ICU locale inference, genealogy, font, rendering, normalization, collation, transform, or shaping behavior is ingested.",
      "ICU-only or ISO/CLDR language-tag codes outside the UCD Script property rows remain BLOCKED.",
      "All output remains preview-only with PRODUCTION_READY=false and runtimeEnabled=0.",
    ],
  });

  writeFileSync(OUT.report, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(OUT.crosswalk, `${JSON.stringify(crosswalk, null, 2)}\n`);
  writeFileSync(OUT.diffPreview, `${JSON.stringify(diffPreview, null, 2)}\n`);
  writeFileSync(OUT.blockers, `${JSON.stringify(blockers, null, 2)}\n`);
  writeFileSync(OUT.evidence, `${JSON.stringify(evidence, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        generated: OUT,
        counts: evidence.counts,
        checks,
      },
      null,
      2,
    ),
  );
}

main();
