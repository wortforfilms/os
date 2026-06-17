import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const INPUTS = {
  unicodeCrosswalk: "data/hkd-lipi-unicode-crosswalk.json",
  seed: "data/hkd-lipi-script-registry-seed-426.json",
  cldrCoreZip: "data/cldr/cldr-core.zip",
};

const OUT = {
  report: "data/cldr-ingestion-report.json",
  crosswalk: "data/cldr-script-locale-crosswalk.json",
  diffPreview: "data/cldr-diff-preview.json",
  blockers: "data/cldr-blockers.json",
  evidence: "release/evidence/hkd-lipi-registry-phase10-cldr-ingestion.json",
};

const GENERATED_AT = "DETERMINISTIC_FROM_OFFICIAL_CLDR_CORE_SNAPSHOT";
const GENERATED_BY = "scripts/generate-hkd-lipi-registry-phase10-cldr-ingestion.mjs";
const REVIEW_STATE = "CONTROLLED_NO_GO";
const PHKD_VERDICT = "CONTROLLED_NO_GO";
const GOVERNED_PRODUCTION_GO = false;
const PRODUCTION_READY = false;
const RUNTIME_ENABLED = 0;
const SOURCE_POLICY = "cldr_official_source_only_locale_script_metadata_no_registry_mutation";
const OFFICIAL_SOURCE_URL = "https://unicode.org/Public/cldr/latest/core.zip";
const OFFICIAL_SOURCE_PAGE = "https://cldr.unicode.org/index/downloads";
const OFFICIAL_SOURCE_ID = "cldr-official-core-zip";

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

function provenance(scope, sourceIds = [OFFICIAL_SOURCE_ID], inputPaths = Object.values(INPUTS)) {
  return {
    scope,
    sourceIds: unique(sourceIds),
    generatedBy: GENERATED_BY,
    sourcePolicy: SOURCE_POLICY,
    officialSourceUrl: OFFICIAL_SOURCE_URL,
    trustedInputs: unique(inputPaths),
    reviewed: false,
    phkd: "CLDR_LOCALE_SCRIPT_METADATA_ONLY_NO_USAGE_INFERENCE",
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
      sourcePage: OFFICIAL_SOURCE_PAGE,
      localPath: INPUTS.cldrCoreZip,
      sha256: sha256(INPUTS.cldrCoreZip),
      format: "CLDR core.zip with LDML XML under common/main/*.xml",
      note: "Phase 10 reads only explicit LDML locale identity script subtags; it does not use likelySubtags, languageData, genealogy, fonts, or transforms.",
    },
    trustedInputs: Object.entries(INPUTS).map(([id, path]) => ({ id, path, sha256: sha256(path) })),
    provenance: provenance(schema),
    ...extra,
  };
}

function zipList(zipPath) {
  return execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 })
    .split(/\r?\n/)
    .filter(Boolean);
}

function zipRead(zipPath, path) {
  return execFileSync("unzip", ["-p", zipPath, path], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
}

function attr(xml, tagName) {
  return xml.match(new RegExp(`<${tagName}\\s+type="([^"]+)"\\s*\\/>`))?.[1] ?? "UNKNOWN";
}

function parseLocaleIdentity(zipPath, file) {
  const xml = zipRead(zipPath, file);
  const localeId = file.replace(/^common\/main\//, "").replace(/\.xml$/, "");
  const language = attr(xml, "language");
  const script = attr(xml, "script");
  const territory = attr(xml, "territory");
  const variant = attr(xml, "variant");
  return {
    localeId,
    language,
    script,
    territory,
    variant,
    sourcePath: file,
    sourceSha256: sha256(Buffer.from(xml)),
  };
}

function makeLink(identity) {
  return {
    id: `phase10:cldr-locale-script:${slug(identity.localeId)}`,
    localeId: identity.localeId,
    language: identity.language,
    script: identity.script,
    territory: identity.territory,
    variant: identity.variant,
    relationType: "EXPLICIT_LDML_IDENTITY_SCRIPT",
    sourcePath: identity.sourcePath,
    sourceSha256: identity.sourceSha256,
    sourceBacked: true,
    languageUsageClaim: "NOT_ASSERTED",
    genealogyClaim: "NOT_ASSERTED",
    fontClaim: "NOT_ASSERTED",
    provenance: provenance("cldr_locale_script_link"),
  };
}

function makeCrosswalkRow(unicodeRow, linksByScript) {
  const links = linksByScript.get(unicodeRow.unicodeScriptAlias) ?? [];
  const status = links.length > 0 ? "VERIFIED" : "UNKNOWN";
  return {
    id: `phase10:cldr-script-locale:${slug(unicodeRow.unicodeScriptValue)}`,
    unicodeScriptValue: unicodeRow.unicodeScriptValue,
    unicodeScriptAlias: unicodeRow.unicodeScriptAlias,
    iso15924: unicodeRow.iso15924,
    status,
    explicitLocaleScriptLinks: links.length,
    sourceBacked: links.length > 0,
    localeLinks: links,
    languageUsageClaim: "NOT_ASSERTED",
    genealogyClaim: "NOT_ASSERTED",
    fontClaim: "NOT_ASSERTED",
    previewOnly: true,
    wouldMutateRegistry: false,
    wouldEnrichRow: false,
    wouldEnableRuntime: false,
    provenance: provenance("cldr_script_locale_crosswalk_row"),
  };
}

function makeDiff(row) {
  return {
    id: `phase10:diff:${slug(row.unicodeScriptValue)}`,
    unicodeScriptValue: row.unicodeScriptValue,
    unicodeScriptAlias: row.unicodeScriptAlias,
    status: row.status,
    diffKind: row.status === "VERIFIED" ? "SOURCE_BACKED_METADATA_PREVIEW_ONLY" : "NO_EXPLICIT_CLDR_SCRIPT_LOCALE_LINK",
    proposedFieldChange: false,
    proposedRegistryPatch: [],
    previewOnly: true,
    wouldMutateRegistry: false,
    wouldEnrichRow: false,
    wouldEnableRuntime: false,
    sourceBackedLocaleLinks: row.explicitLocaleScriptLinks,
    reason:
      row.status === "VERIFIED"
        ? "CLDR has explicit locale identity script metadata for this script; no registry change is proposed."
        : "CLDR has no explicit locale identity script metadata for this script in common/main; no locale-script claim is inferred.",
    provenance: provenance("cldr_diff_preview_row"),
  };
}

function makeUnmatchedScriptBlocker(script, links) {
  return {
    id: `phase10:blocker:unmatched-cldr-script:${slug(script)}`,
    cldrScript: script,
    status: "BLOCKED",
    severity: "HIGH",
    blocksPromotion: true,
    relationType: "EXPLICIT_LDML_IDENTITY_SCRIPT",
    localeLinks: links,
    reason: `CLDR script ${script} appears in explicit locale identities but does not map to a Unicode Script property row in the 176-row registry; no merge or genealogy inference is allowed.`,
    requiredToUnblock: ["review CLDR script code class", "attach mapping policy", "rerun CLDR dry ingestion"],
    provenance: provenance("cldr_ambiguous_script_locale_blocker"),
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
  const files = zipList(INPUTS.cldrCoreZip).filter((path) => /^common\/main\/.+\.xml$/.test(path));
  const identities = files.map((file) => parseLocaleIdentity(INPUTS.cldrCoreZip, file));
  const explicitLinks = identities.filter((identity) => identity.script !== "UNKNOWN").map(makeLink);
  const linksByScript = new Map();
  for (const link of explicitLinks) {
    linksByScript.set(link.script, [...(linksByScript.get(link.script) ?? []), link]);
  }

  const registryScriptAliases = new Set(unicodeCrosswalk.records.map((record) => record.unicodeScriptAlias));
  const cldrScriptCodes = Array.from(linksByScript.keys()).sort();
  const unmatchedCldrScripts = cldrScriptCodes.filter((script) => !registryScriptAliases.has(script));
  const crosswalkRows = unicodeCrosswalk.records.map((row) => makeCrosswalkRow(row, linksByScript));
  const diffRows = crosswalkRows.map(makeDiff);
  const blockerRows = unmatchedCldrScripts.map((script) => makeUnmatchedScriptBlocker(script, linksByScript.get(script) ?? []));
  const statuses = countBy(crosswalkRows, (row) => row.status);

  const crosswalk = baseArtifact("cldr-script-locale-crosswalk.v1", {
    summary: {
      unicodeScriptRowsCompared: crosswalkRows.length,
      cldrMainLocaleFiles: files.length,
      explicitLocaleScriptLinks: explicitLinks.length,
      cldrScriptCodesWithExplicitLinks: cldrScriptCodes.length,
      matchedRegistryScriptCodes: cldrScriptCodes.filter((script) => registryScriptAliases.has(script)).length,
      unmatchedCldrScriptCodes: unmatchedCldrScripts.length,
      verifiedRows: statuses.VERIFIED ?? 0,
      unknownRows: statuses.UNKNOWN ?? 0,
      blockedRows: statuses.BLOCKED ?? 0,
      previewOnlyRows: crosswalkRows.filter((row) => row.previewOnly).length,
      registryMutations: crosswalkRows.filter((row) => row.wouldMutateRegistry).length,
      enrichedRows: crosswalkRows.filter((row) => row.wouldEnrichRow).length,
      runtimeEnablements: crosswalkRows.filter((row) => row.wouldEnableRuntime).length,
    },
    cldrScriptCodes,
    unmatchedCldrScripts,
    rows: crosswalkRows,
  });

  const diffPreview = baseArtifact("cldr-diff-preview.v1", {
    summary: {
      diffs: diffRows.length,
      sourceBackedMetadataPreviews: diffRows.filter((row) => row.diffKind === "SOURCE_BACKED_METADATA_PREVIEW_ONLY").length,
      noExplicitLinkPreviews: diffRows.filter((row) => row.diffKind === "NO_EXPLICIT_CLDR_SCRIPT_LOCALE_LINK").length,
      proposedFieldChanges: diffRows.filter((row) => row.proposedFieldChange).length,
      previewOnlyRows: diffRows.filter((row) => row.previewOnly).length,
      registryMutations: diffRows.filter((row) => row.wouldMutateRegistry).length,
      enrichedRows: diffRows.filter((row) => row.wouldEnrichRow).length,
      runtimeEnablements: diffRows.filter((row) => row.wouldEnableRuntime).length,
    },
    diffs: diffRows,
  });

  const blockers = baseArtifact("cldr-blockers.v1", {
    summary: {
      blockers: blockerRows.length,
      ambiguousScriptLocaleRelations: blockerRows.length,
      highSeverity: blockerRows.filter((row) => row.severity === "HIGH").length,
      promotionBlocked: blockerRows.length > 0,
    },
    ambiguousRelationPolicy: {
      ambiguousRelationsDetected: blockerRows.length,
      promotionAllowedWhenAmbiguous: false,
      enforced: true,
      rule: "ANY_AMBIGUOUS_CLDR_SCRIPT_LOCALE_RELATION_BLOCKS_PROMOTION",
    },
    blockers: blockerRows,
  });

  const report = baseArtifact("cldr-ingestion-report.v1", {
    ingestion: {
      mode: "CLDR_LOCALE_SCRIPT_METADATA_DRY_RUN_ONLY",
      adapter: "cldr",
      cldrMainLocaleFiles: files.length,
      explicitLocaleScriptLinks: explicitLinks.length,
      unicodeScriptRowsCompared: crosswalkRows.length,
      rowsWritten: 0,
      enrichedRows: 0,
      runtimeEnablements: 0,
      proposedFieldChanges: diffPreview.summary.proposedFieldChanges,
      blockers: blockers.summary.blockers,
      ambiguousRelations: blockers.summary.ambiguousScriptLocaleRelations,
      promotionStatus: blockers.summary.promotionBlocked ? "BLOCKED" : "PREVIEW_ONLY",
      ambiguousRelationsBlockPromotion: true,
      seedHashBefore,
      seedHashAfter: sha256(INPUTS.seed),
    },
    summary: {
      verifiedRows: crosswalk.summary.verifiedRows,
      unknownRows: crosswalk.summary.unknownRows,
      blockedRows: crosswalk.summary.blockedRows,
      matchedRegistryScriptCodes: crosswalk.summary.matchedRegistryScriptCodes,
      unmatchedCldrScriptCodes: crosswalk.summary.unmatchedCldrScriptCodes,
    },
  });

  const evidence = baseArtifact("hkd-lipi-registry-phase10-cldr-ingestion.v1", {
    counts: {
      cldrMainLocaleFiles: files.length,
      explicitLocaleScriptLinks: explicitLinks.length,
      unicodeScriptRowsCompared: crosswalkRows.length,
      verifiedRows: crosswalk.summary.verifiedRows,
      unknownRows: crosswalk.summary.unknownRows,
      blockers: blockers.summary.blockers,
      proposedFieldChanges: diffPreview.summary.proposedFieldChanges,
      rowsWritten: report.ingestion.rowsWritten,
      enrichedRows: report.ingestion.enrichedRows,
      runtimeEnablements: report.ingestion.runtimeEnablements,
    },
    checks: {
      officialCldrSourceOnly: true,
      localeScriptLinksSourceBacked: explicitLinks.every((link) => link.sourceBacked === true && link.sourcePath.startsWith("common/main/")),
      noInventedLanguageUsageClaims: crosswalkRows.every((row) => row.languageUsageClaim === "NOT_ASSERTED") && explicitLinks.every((link) => link.languageUsageClaim === "NOT_ASSERTED"),
      noGenealogyClaims: crosswalkRows.every((row) => row.genealogyClaim === "NOT_ASSERTED") && explicitLinks.every((link) => link.genealogyClaim === "NOT_ASSERTED"),
      noFontClaims: crosswalkRows.every((row) => row.fontClaim === "NOT_ASSERTED") && explicitLinks.every((link) => link.fontClaim === "NOT_ASSERTED"),
      ambiguousRelationsBlocked: blockerRows.every((row) => row.status === "BLOCKED" && row.blocksPromotion === true),
      noRegistryMutation: report.ingestion.rowsWritten === 0 && report.ingestion.seedHashBefore === report.ingestion.seedHashAfter,
      previewOnlyDiffs: diffRows.every((row) => row.previewOnly === true && row.wouldMutateRegistry === false),
      noEnrichedRows: report.ingestion.enrichedRows === 0 && diffPreview.summary.enrichedRows === 0,
      noRuntimeEnablement: report.ingestion.runtimeEnablements === 0 && diffPreview.summary.runtimeEnablements === 0 && seed.records.every((record) => record.hkd_runtime_enabled === false),
      noProductionReadyTrue: PRODUCTION_READY === false,
      allOutputsHaveProvenance: [report, crosswalk, diffPreview, blockers].every((artifact) => artifact.provenance?.sourceIds?.includes(OFFICIAL_SOURCE_ID)),
    },
    outputs: OUT,
    limitations: [
      "Phase 10 uses CLDR common/main locale identity script subtags only.",
      "Likely-subtags, supplemental languageData, genealogy, transforms, and font claims are deliberately out of scope.",
      "Locale-script links are metadata previews and do not assert real-world language usage.",
      "CLDR script codes that do not map to a registry Unicode Script row are blocked.",
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
        checks: evidence.checks,
      },
      null,
      2,
    ),
  );
}

main();
