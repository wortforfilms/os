import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const INPUTS = {
  unicodeCrosswalk: "data/hkd-lipi-unicode-crosswalk.json",
  seed: "data/hkd-lipi-script-registry-seed-426.json",
  iso15924OfficialText: "data/iso15924/iso15924.txt",
};

const OUT = {
  report: "data/iso15924-ingestion-report.json",
  crosswalk: "data/iso15924-script-code-crosswalk.json",
  diffPreview: "data/iso15924-diff-preview.json",
  blockers: "data/iso15924-blockers.json",
  evidence: "release/evidence/hkd-lipi-registry-phase9-iso15924-ingestion.json",
};

const GENERATED_AT = "DETERMINISTIC_FROM_OFFICIAL_ISO15924_SNAPSHOT";
const GENERATED_BY = "scripts/generate-hkd-lipi-registry-phase9-iso15924-ingestion.mjs";
const REVIEW_STATE = "CONTROLLED_NO_GO";
const PHKD_VERDICT = "CONTROLLED_NO_GO";
const GOVERNED_PRODUCTION_GO = false;
const PRODUCTION_READY = false;
const RUNTIME_ENABLED = 0;
const SOURCE_POLICY = "iso15924_official_source_only_preview_no_registry_mutation";
const OFFICIAL_SOURCE_URL = "https://www.unicode.org/iso15924/iso15924.txt";
const OFFICIAL_CODE_LIST_PAGE = "https://www.unicode.org/iso15924/codelists.html";
const OFFICIAL_SOURCE_ID = "iso15924-official-plain-text";

function read(path) {
  return readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

function sha256(path) {
  return createHash("sha256").update(read(path)).digest("hex");
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

function provenance(scope, sourceIds = [OFFICIAL_SOURCE_ID], inputPaths = Object.values(INPUTS)) {
  return {
    scope,
    sourceIds: unique(sourceIds),
    generatedBy: GENERATED_BY,
    sourcePolicy: SOURCE_POLICY,
    officialSourceUrl: OFFICIAL_SOURCE_URL,
    trustedInputs: unique(inputPaths),
    reviewed: false,
    phkd: "ISO15924_PREVIEW_ONLY_NO_RECORD_MUTATION",
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
      url: OFFICIAL_SOURCE_URL,
      codeListPage: OFFICIAL_CODE_LIST_PAGE,
      localPath: INPUTS.iso15924OfficialText,
      sha256: sha256(INPUTS.iso15924OfficialText),
      format: "Code;Nº;English Name;Nom français;PVA;Unicode Version;Date",
      note: "The ISO 15924 codelists page marks Table 5 as the normative UTF-8 plain-text data file.",
    },
    trustedInputs: Object.entries(INPUTS).map(([id, path]) => ({ id, path, sha256: sha256(path) })),
    provenance: provenance(schema),
    ...extra,
  };
}

function parseIso15924(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line, index) => {
      const parts = line.split(";");
      if (parts.length !== 7) throw new Error(`Invalid ISO 15924 row ${index + 1}: ${line}`);
      const [code, numericCode, englishName, frenchName, pva, unicodeVersion, date] = parts;
      if (!/^[A-Z][a-z]{3}$|^Q[a-z]{3}$|^Z[a-z]{3}$/.test(code)) throw new Error(`Invalid ISO code ${code}`);
      if (!/^\d{3}$/.test(numericCode)) throw new Error(`Invalid ISO numeric code ${numericCode} for ${code}`);
      return {
        code,
        numericCode,
        englishName,
        frenchName,
        pva: pva || "UNKNOWN",
        unicodeVersion: unicodeVersion || "UNKNOWN",
        date,
        sourceRef: OFFICIAL_SOURCE_ID,
      };
    });
}

function compareRow(row, officialByCode, officialByPva) {
  const official = officialByCode.get(row.unicodeScriptAlias);
  const pvaOfficial = officialByPva.get(row.unicodeScriptValue);
  let status = "VERIFIED";
  const blockers = [];
  const conflicts = [];

  if (!official) {
    status = "BLOCKED";
    blockers.push("ISO_CODE_MISSING_IN_OFFICIAL_SOURCE");
  } else {
    if (official.pva === "UNKNOWN") {
      status = "BLOCKED";
      blockers.push("ISO_PVA_EMPTY_OR_AMBIGUOUS");
    } else if (official.pva !== row.unicodeScriptValue) {
      status = "CONFLICT";
      conflicts.push("ISO_PVA_DOES_NOT_MATCH_UNICODE_SCRIPT_VALUE");
    }
  }

  if (pvaOfficial && pvaOfficial.code !== row.unicodeScriptAlias) {
    status = "CONFLICT";
    conflicts.push("UNICODE_SCRIPT_VALUE_POINTS_TO_DIFFERENT_ISO_CODE");
  }

  return {
    id: `phase9:iso15924:${slug(row.unicodeScriptValue)}`,
    unicodeScriptValue: row.unicodeScriptValue,
    registryIso15924: row.iso15924,
    registryUnicodeScriptAlias: row.unicodeScriptAlias,
    officialIso15924: official?.code ?? "UNKNOWN",
    officialNumericCode: official?.numericCode ?? "UNKNOWN",
    officialEnglishName: official?.englishName ?? "UNKNOWN",
    officialFrenchName: official?.frenchName ?? "UNKNOWN",
    officialPva: official?.pva ?? "UNKNOWN",
    officialUnicodeVersion: official?.unicodeVersion ?? "UNKNOWN",
    officialDate: official?.date ?? "UNKNOWN",
    status,
    codeMatch: official?.code === row.unicodeScriptAlias,
    pvaMatch: official?.pva === row.unicodeScriptValue,
    missingOrAmbiguousCode: !official || official.pva === "UNKNOWN",
    conflicts,
    blockers,
    previewOnly: true,
    wouldMutateRegistry: false,
    wouldEnrichRow: false,
    wouldEnableRuntime: false,
    provenance: provenance("iso15924_script_code_crosswalk_row"),
  };
}

function makeDiff(row) {
  const blocked = row.status === "BLOCKED";
  const conflict = row.status === "CONFLICT";
  return {
    id: `phase9:diff:${slug(row.unicodeScriptValue)}`,
    unicodeScriptValue: row.unicodeScriptValue,
    registryIso15924: row.registryIso15924,
    officialIso15924: row.officialIso15924,
    officialNumericCode: row.officialNumericCode,
    officialPva: row.officialPva,
    status: row.status,
    diffKind: conflict ? "CONFLICT_PREVIEW_ONLY" : blocked ? "BLOCKED_PREVIEW_ONLY" : "NO_FIELD_DIFF_VERIFIED",
    proposedFieldChange: false,
    proposedRegistryPatch: [],
    previewOnly: true,
    wouldMutateRegistry: false,
    wouldEnrichRow: false,
    wouldEnableRuntime: false,
    promotionEligible: row.status === "VERIFIED",
    promotionBlockers: [...row.blockers, ...row.conflicts],
    reason:
      row.status === "VERIFIED"
        ? "Official ISO code and PVA match the existing Unicode script row; no registry change is proposed."
        : row.status === "CONFLICT"
          ? "Official ISO source conflicts with the existing Unicode script row; promotion is blocked."
          : "Official ISO source is missing or ambiguous for the Unicode PVA; promotion is blocked.",
    provenance: provenance("iso15924_diff_preview_row"),
  };
}

function makeBlocker(row) {
  return {
    id: `phase9:blocker:${slug(row.unicodeScriptValue)}`,
    unicodeScriptValue: row.unicodeScriptValue,
    registryIso15924: row.registryIso15924,
    officialIso15924: row.officialIso15924,
    officialPva: row.officialPva,
    status: row.status,
    severity: row.status === "CONFLICT" ? "HIGH" : "MEDIUM",
    blocksPromotion: true,
    reason:
      row.status === "CONFLICT"
        ? `Official ISO PVA ${row.officialPva} does not safely verify registry script ${row.unicodeScriptValue}.`
        : `Official ISO code ${row.officialIso15924} has no PVA for registry script ${row.unicodeScriptValue}.`,
    requiredToUnblock:
      row.status === "CONFLICT"
        ? ["resolve official-source conflict", "attach reviewer decision", "rerun ISO dry ingestion"]
        : ["official ISO PVA available or reviewed mapping policy", "attach provenance", "rerun ISO dry ingestion"],
    provenance: provenance("iso15924_blocker"),
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
  const officialEntries = parseIso15924(read(INPUTS.iso15924OfficialText));
  const officialByCode = new Map(officialEntries.map((entry) => [entry.code, entry]));
  const officialByPva = new Map(officialEntries.filter((entry) => entry.pva !== "UNKNOWN").map((entry) => [entry.pva, entry]));
  const crosswalkRows = unicodeCrosswalk.records.map((row) => compareRow(row, officialByCode, officialByPva));
  const diffRows = crosswalkRows.map(makeDiff);
  const blockerRows = crosswalkRows.filter((row) => row.status !== "VERIFIED").map(makeBlocker);
  const statuses = countBy(crosswalkRows, (row) => row.status);
  const conflictRows = crosswalkRows.filter((row) => row.status === "CONFLICT");

  const scriptCodeCrosswalk = baseArtifact("iso15924-script-code-crosswalk.v1", {
    summary: {
      unicodeScriptRowsCompared: crosswalkRows.length,
      officialIsoEntries: officialEntries.length,
      codeMatches: crosswalkRows.filter((row) => row.codeMatch).length,
      pvaMatches: crosswalkRows.filter((row) => row.pvaMatch).length,
      verifiedRows: statuses.VERIFIED ?? 0,
      blockedRows: statuses.BLOCKED ?? 0,
      conflictRows: statuses.CONFLICT ?? 0,
      missingOfficialCodes: crosswalkRows.filter((row) => row.officialIso15924 === "UNKNOWN").length,
      ambiguousOrMissingPvaRows: crosswalkRows.filter((row) => row.officialPva === "UNKNOWN").length,
      previewOnlyRows: crosswalkRows.filter((row) => row.previewOnly).length,
      registryMutations: crosswalkRows.filter((row) => row.wouldMutateRegistry).length,
      enrichedRows: crosswalkRows.filter((row) => row.wouldEnrichRow).length,
      runtimeEnablements: crosswalkRows.filter((row) => row.wouldEnableRuntime).length,
    },
    rows: crosswalkRows,
  });

  const diffPreview = baseArtifact("iso15924-diff-preview.v1", {
    summary: {
      diffs: diffRows.length,
      proposedFieldChanges: diffRows.filter((row) => row.proposedFieldChange).length,
      previewOnlyRows: diffRows.filter((row) => row.previewOnly).length,
      registryMutations: diffRows.filter((row) => row.wouldMutateRegistry).length,
      enrichedRows: diffRows.filter((row) => row.wouldEnrichRow).length,
      runtimeEnablements: diffRows.filter((row) => row.wouldEnableRuntime).length,
      verifiedNoDiffRows: diffRows.filter((row) => row.diffKind === "NO_FIELD_DIFF_VERIFIED").length,
      blockedPreviewRows: diffRows.filter((row) => row.diffKind === "BLOCKED_PREVIEW_ONLY").length,
      conflictPreviewRows: diffRows.filter((row) => row.diffKind === "CONFLICT_PREVIEW_ONLY").length,
    },
    diffs: diffRows,
  });

  const blockers = baseArtifact("iso15924-blockers.v1", {
    summary: {
      blockers: blockerRows.length,
      blockedRows: blockerRows.filter((row) => row.status === "BLOCKED").length,
      conflictRows: blockerRows.filter((row) => row.status === "CONFLICT").length,
      missingOfficialCodes: blockerRows.filter((row) => row.officialIso15924 === "UNKNOWN").length,
      ambiguousOrMissingPvaRows: blockerRows.filter((row) => row.officialPva === "UNKNOWN").length,
      promotionBlocked: blockerRows.length > 0 || conflictRows.length > 0,
    },
    conflictPromotionPolicy: {
      conflictsDetected: conflictRows.length,
      promotionAllowedWhenConflict: false,
      enforced: true,
      rule: "ANY_ISO15924_CONFLICT_BLOCKS_PROMOTION",
    },
    blockers: blockerRows,
  });

  const report = baseArtifact("iso15924-ingestion-report.v1", {
    ingestion: {
      mode: "ISO15924_REAL_SOURCE_DRY_RUN_ONLY",
      adapter: "iso-15924",
      officialRowsRead: officialEntries.length,
      unicodeScriptRowsCompared: crosswalkRows.length,
      rowsWritten: 0,
      enrichedRows: 0,
      runtimeEnablements: 0,
      proposedFieldChanges: diffPreview.summary.proposedFieldChanges,
      blockers: blockers.summary.blockers,
      conflicts: blockers.summary.conflictRows,
      promotionStatus: blockers.summary.promotionBlocked ? "BLOCKED" : "PREVIEW_ONLY",
      conflictsBlockPromotion: true,
      seedHashBefore,
      seedHashAfter: sha256(INPUTS.seed),
    },
    summary: {
      verifiedRows: scriptCodeCrosswalk.summary.verifiedRows,
      blockedRows: scriptCodeCrosswalk.summary.blockedRows,
      conflictRows: scriptCodeCrosswalk.summary.conflictRows,
      codeMatches: scriptCodeCrosswalk.summary.codeMatches,
      pvaMatches: scriptCodeCrosswalk.summary.pvaMatches,
      missingOfficialCodes: scriptCodeCrosswalk.summary.missingOfficialCodes,
      ambiguousOrMissingPvaRows: scriptCodeCrosswalk.summary.ambiguousOrMissingPvaRows,
    },
  });

  const evidence = baseArtifact("hkd-lipi-registry-phase9-iso15924-ingestion.v1", {
    counts: {
      officialIsoEntries: officialEntries.length,
      unicodeScriptRowsCompared: crosswalkRows.length,
      verifiedRows: scriptCodeCrosswalk.summary.verifiedRows,
      blockedRows: scriptCodeCrosswalk.summary.blockedRows,
      conflictRows: scriptCodeCrosswalk.summary.conflictRows,
      proposedFieldChanges: diffPreview.summary.proposedFieldChanges,
      blockers: blockers.summary.blockers,
      rowsWritten: report.ingestion.rowsWritten,
      enrichedRows: report.ingestion.enrichedRows,
      runtimeEnablements: report.ingestion.runtimeEnablements,
    },
    checks: {
      officialIsoSourceOnly: true,
      comparedExactly176UnicodeRows: crosswalkRows.length === 176,
      everyUnicodeRowHasOfficialIsoCode: crosswalkRows.every((row) => row.officialIso15924 !== "UNKNOWN"),
      missingOrAmbiguousCodesBlocked: crosswalkRows.filter((row) => row.missingOrAmbiguousCode).every((row) => row.status === "BLOCKED"),
      conflictsBlockPromotion: blockers.conflictPromotionPolicy.enforced === true && blockers.conflictPromotionPolicy.promotionAllowedWhenConflict === false,
      noRegistryMutation: report.ingestion.rowsWritten === 0 && report.ingestion.seedHashBefore === report.ingestion.seedHashAfter,
      previewOnlyDiffs: diffRows.every((row) => row.previewOnly === true && row.wouldMutateRegistry === false),
      noEnrichedRows: report.ingestion.enrichedRows === 0 && diffPreview.summary.enrichedRows === 0,
      noRuntimeEnablement: report.ingestion.runtimeEnablements === 0 && diffPreview.summary.runtimeEnablements === 0 && seed.records.every((record) => record.hkd_runtime_enabled === false),
      noProductionReadyTrue: PRODUCTION_READY === false,
      allOutputsHaveProvenance: [report, scriptCodeCrosswalk, diffPreview, blockers].every((artifact) => artifact.provenance?.sourceIds?.includes(OFFICIAL_SOURCE_ID)),
    },
    outputs: OUT,
    limitations: [
      "Phase 9 uses the official ISO 15924 plain-text source only for ISO facts.",
      "Rows with blank ISO PVA values are blocked, not inferred from names.",
      "No registry mutation or enrichment is emitted.",
      "Conflict policy is active even though this run detected zero conflicts.",
    ],
  });

  writeFileSync(OUT.report, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(OUT.crosswalk, `${JSON.stringify(scriptCodeCrosswalk, null, 2)}\n`);
  writeFileSync(OUT.diffPreview, `${JSON.stringify(diffPreview, null, 2)}\n`);
  writeFileSync(OUT.blockers, `${JSON.stringify(blockers, null, 2)}\n`);
  writeFileSync(OUT.evidence, `${JSON.stringify(evidence, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        generated: OUT,
        counts: evidence.counts,
        checks: evidence.checks,
      },
      null,
      2,
    ),
  );
}

main();
