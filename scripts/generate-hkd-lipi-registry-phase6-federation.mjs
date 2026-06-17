import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const INPUTS = {
  seed: "data/hkd-lipi-script-registry-seed-426.json",
  crosswalk: "data/hkd-lipi-unicode-crosswalk.json",
  numeral: "data/hkd-lipi-numeral-registry.json",
  zero: "data/hkd-lipi-zero-registry.json",
  kbsGraph: "data/hkd-lipi-kbs-graph.json",
  audit: "release/evidence/hkd-lipi-registry-audit-report.json",
  provenance: "release/evidence/hkd-lipi-registry-provenance-report.json",
};

const LOCAL_SOURCE_FILES = {
  unicodeUcdPropertyValueAliases: "data/unicode/ucd-latest/PropertyValueAliases.txt",
  unicodeUcdScripts: "data/unicode/ucd-latest/Scripts.txt",
  unicodeUcdBlocks: "data/unicode/ucd-latest/Blocks.txt",
  unicodeUcdUnicodeData: "data/unicode/ucd-latest/UnicodeData.txt",
  unicodeUcdDerivedAge: "data/unicode/ucd-latest/DerivedAge.txt",
  unicodeUcdScriptExtensions: "data/unicode/ucd-latest/ScriptExtensions.txt",
};

const OUT = {
  sourceRegistry: "data/hkd-lipi-federated-source-registry.json",
  lineageGraph: "data/hkd-lipi-evidence-lineage-graph.json",
  conflictDetector: "data/hkd-lipi-source-conflict-detector.json",
  provenanceChains: "data/hkd-lipi-provenance-chain-explorer.json",
  evidence: "release/evidence/hkd-lipi-registry-phase6-federation.json",
};

const GENERATED_AT = "DETERMINISTIC_FROM_FEDERATED_SOURCE_INPUTS";
const REVIEW_STATE = "CONTROLLED_NO_GO";
const GOVERNED_PRODUCTION_GO = false;
const PRODUCTION_READY = false;
const RUNTIME_ENABLED = 0;
const PHKD_VERDICT = "CONTROLLED_NO_GO";
const SOURCE_POLICY = "cross_reference_only_no_new_script_claims";
const GENERATED_BY = "scripts/generate-hkd-lipi-registry-phase6-federation.mjs";

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

function provenance(scope, sourceIds, inputPaths = Object.values(INPUTS)) {
  return {
    scope,
    sourceIds: unique(sourceIds),
    generatedBy: GENERATED_BY,
    sourcePolicy: SOURCE_POLICY,
    trustedInputs: unique(inputPaths),
    reviewed: false,
    phkd: "FACTS_FROM_SOURCES_OR_UNKNOWN",
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
    trustedInputs: Object.entries(INPUTS).map(([id, path]) => ({ id, path, sha256: sha256(path) })),
    ...extra,
  };
}

function makeSource({ id, displayName, authority, sourceClass, officialUrl, localStatus, evidenceSourceIds = [], localArtifacts, trustedFor, notTrustedFor, notes }) {
  return {
    id,
    displayName,
    authority,
    sourceClass,
    officialUrl,
    localStatus,
    evidenceSourceIds: unique([id, ...evidenceSourceIds]),
    localArtifacts: localArtifacts.map((path) => ({
      path,
      exists: existsSync(path),
      sha256: existsSync(path) ? sha256(path) : "NOT_LOCAL",
    })),
    claimPolicy: "VALIDATE_EXISTING_FACTS_ONLY",
    createsNewScriptClaims: false,
    trustedFor,
    notTrustedFor,
    notes,
    provenance: provenance("federated_source_registry_entry", [id, ...evidenceSourceIds], []),
  };
}

function makeNode(type, id, label, fields, sourceRefs) {
  return {
    id,
    type,
    label,
    fields,
    sourceRefs: unique(sourceRefs),
    provenance: provenance(`lineage_${type.toLowerCase()}_node`, sourceRefs),
  };
}

function makeEdge(type, from, to, fields, sourceRefs) {
  return {
    id: `phase6:edge:${slug(type)}:${slug(from)}:${slug(to)}`,
    type,
    from,
    to,
    fields,
    sourceRefs: unique(sourceRefs),
    provenance: provenance(`lineage_${type.toLowerCase()}_edge`, sourceRefs),
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
  const seed = readJson(INPUTS.seed);
  const crosswalk = readJson(INPUTS.crosswalk);
  const numeral = readJson(INPUTS.numeral);
  const zero = readJson(INPUTS.zero);
  const kbsGraph = readJson(INPUTS.kbsGraph);
  const audit = readJson(INPUTS.audit);
  const provenanceReport = readJson(INPUTS.provenance);
  const records = seed.records;
  const sourceRefsInGraph = unique([
    ...kbsGraph.nodes.flatMap((node) => node.provenance?.sourceIds ?? []),
    ...kbsGraph.edges.flatMap((edge) => edge.provenance?.sourceIds ?? []),
  ]);

  const sources = [
    makeSource({
      id: "unicode-ucd",
      displayName: "Unicode Character Database",
      authority: "Unicode Consortium",
      sourceClass: "external_authoritative_dataset",
      officialUrl: "https://www.unicode.org/ucd/",
      localStatus: "LOCAL_INGESTED",
      evidenceSourceIds: [
        "unicode-ucd-17-property-value-aliases",
        "unicode-ucd-17-scripts",
        "unicode-ucd-17-blocks",
        "unicode-ucd-17-unicode-data",
        "unicode-ucd-17-derived-age",
      ],
      localArtifacts: Object.values(LOCAL_SOURCE_FILES),
      trustedFor: ["Unicode Script property values", "Unicode ranges", "Unicode blocks", "decimal digit inventories", "zero glyphs"],
      notTrustedFor: ["font support", "shaping behavior", "transliteration systems", "genealogical descent"],
      notes: "Local UCD files are the only ingested external dataset in this federation layer.",
    }),
    makeSource({
      id: "iso-15924",
      displayName: "ISO 15924 Registration Authority",
      authority: "ISO 15924/RA at Unicode Consortium",
      sourceClass: "external_authoritative_registry",
      officialUrl: "https://www.unicode.org/iso15924/",
      localStatus: "PARTIAL_VIA_UCD_PROPERTY_VALUE_ALIASES",
      evidenceSourceIds: ["unicode-ucd-17-property-value-aliases"],
      localArtifacts: [LOCAL_SOURCE_FILES.unicodeUcdPropertyValueAliases],
      trustedFor: ["cross-checking existing Unicode script aliases only"],
      notTrustedFor: ["numeric ISO 15924 codes", "official ISO code-list deltas", "new script-code assignment"],
      notes: "No standalone ISO 15924 code-list snapshot is present locally; aliases are checked only through UCD PropertyValueAliases.",
    }),
    makeSource({
      id: "cldr",
      displayName: "Unicode CLDR",
      authority: "Unicode Consortium",
      sourceClass: "external_authoritative_dataset",
      officialUrl: "https://cldr.unicode.org/",
      localStatus: "NOT_INGESTED",
      localArtifacts: [],
      trustedFor: ["future locale exemplar, collation, transform, and numbering-system validation after local ingestion"],
      notTrustedFor: ["current script facts", "current registry enablement"],
      notes: "CLDR is registered as an authority but no CLDR data snapshot is present in this checkpoint.",
    }),
    makeSource({
      id: "icu",
      displayName: "ICU International Components for Unicode",
      authority: "Unicode Consortium ICU Technical Committee",
      sourceClass: "external_authoritative_implementation",
      officialUrl: "https://icu.unicode.org/",
      localStatus: "NOT_INGESTED",
      localArtifacts: [],
      trustedFor: ["future implementation behavior checks after local ingestion"],
      notTrustedFor: ["current script facts", "font support", "new registry claims"],
      notes: "ICU is a downstream implementation authority; no ICU data/API snapshot is ingested here.",
    }),
    makeSource({
      id: "harfbuzz",
      displayName: "HarfBuzz",
      authority: "HarfBuzz project",
      sourceClass: "external_authoritative_implementation",
      officialUrl: "https://harfbuzz.github.io/",
      localStatus: "NOT_INGESTED",
      localArtifacts: [],
      trustedFor: ["future shaping behavior verification after local test corpus ingestion"],
      notTrustedFor: ["current script facts", "font support claims", "transliteration mappings"],
      notes: "No HarfBuzz shaping test corpus or versioned snapshot is present locally.",
    }),
    makeSource({
      id: "opentype-spec",
      displayName: "OpenType Specification",
      authority: "Microsoft Typography / OpenType specification",
      sourceClass: "external_authoritative_specification",
      officialUrl: "https://learn.microsoft.com/en-us/typography/opentype/spec/",
      localStatus: "NOT_INGESTED",
      localArtifacts: [],
      trustedFor: ["future font-table and shaping-feature validation after local specification snapshot ingestion"],
      notTrustedFor: ["current script facts", "current font availability", "runtime enablement"],
      notes: "No local OpenType specification snapshot or font evidence is ingested here.",
    }),
    makeSource({
      id: "hkd-registry-architect-user-prompt",
      displayName: "HKD Registry Architect Prompt",
      authority: "HKD project internal",
      sourceClass: "internal_scope_anchor",
      officialUrl: "LOCAL_THREAD_CONTEXT",
      localStatus: "LOCAL_SCOPE_ANCHOR",
      evidenceSourceIds: ["hkd-registry-architect-user-prompt"],
      localArtifacts: [INPUTS.seed],
      trustedFor: ["registry partition scope", "reserved non-Unicode row placeholders"],
      notTrustedFor: ["external script facts", "Unicode assignments", "ISO assignments"],
      notes: "Internal scope source retained because existing graph provenance references it.",
    }),
  ];

  const sourceIds = new Set(sources.map((source) => source.id));
  const registeredEvidenceIds = new Set(sources.flatMap((source) => source.evidenceSourceIds));
  const sourceNodeByEvidenceId = new Map(sources.flatMap((source) => source.evidenceSourceIds.map((evidenceId) => [evidenceId, `phase6:source:${source.id}`])));
  const sourceRegistry = baseArtifact("hkd-lipi-federated-source-registry.v1", {
    summary: {
      sources: sources.length,
      localIngested: sources.filter((source) => source.localStatus === "LOCAL_INGESTED").length,
      partialLocal: sources.filter((source) => source.localStatus.startsWith("PARTIAL")).length,
      notIngested: sources.filter((source) => source.localStatus === "NOT_INGESTED").length,
      createsNewScriptClaims: sources.filter((source) => source.createsNewScriptClaims).length,
    },
    sources,
    provenance: provenance("source_registry", sources.map((source) => source.id), []),
  });

  const lineageNodes = [
    ...sources.map((source) =>
      makeNode(
        "Source",
        `phase6:source:${source.id}`,
        source.displayName,
        {
          sourceId: source.id,
          localStatus: source.localStatus,
          sourceClass: source.sourceClass,
          claimPolicy: source.claimPolicy,
          createsNewScriptClaims: source.createsNewScriptClaims,
        },
        [source.id],
      ),
    ),
    ...unique(sources.flatMap((source) => source.evidenceSourceIds)).map((evidenceId) =>
      makeNode(
        "EvidenceSourceId",
        `phase6:evidence-id:${slug(evidenceId)}`,
        evidenceId,
        {
          evidenceSourceId: evidenceId,
          parentSourceNode: sourceNodeByEvidenceId.get(evidenceId) ?? "UNKNOWN",
        },
        [evidenceId],
      ),
    ),
    ...Object.entries(LOCAL_SOURCE_FILES).map(([id, path]) =>
      makeNode(
        "LocalSourceFile",
        `phase6:local-source-file:${slug(id)}`,
        path,
        {
          key: id,
          path,
          exists: existsSync(path),
          sha256: existsSync(path) ? sha256(path) : "NOT_LOCAL",
        },
        ["unicode-ucd"],
      ),
    ),
    ...Object.entries(INPUTS).map(([id, path]) =>
      makeNode(
        "RegistryArtifact",
        `phase6:artifact:${slug(id)}`,
        path,
        {
          key: id,
          path,
          sha256: sha256(path),
        },
        sourceRefsInGraph.filter((sourceId) => registeredEvidenceIds.has(sourceId)),
      ),
    ),
    makeNode("FederationArtifact", "phase6:artifact:source-registry", OUT.sourceRegistry, { path: OUT.sourceRegistry }, sources.map((source) => source.id)),
    makeNode("FederationArtifact", "phase6:artifact:lineage-graph", OUT.lineageGraph, { path: OUT.lineageGraph }, sources.map((source) => source.id)),
    makeNode("FederationArtifact", "phase6:artifact:conflict-detector", OUT.conflictDetector, { path: OUT.conflictDetector }, sources.map((source) => source.id)),
    makeNode("FederationArtifact", "phase6:artifact:provenance-chains", OUT.provenanceChains, { path: OUT.provenanceChains }, sources.map((source) => source.id)),
  ];

  const lineageEdges = [
    ...sources.flatMap((source) =>
      source.evidenceSourceIds
        .filter((evidenceId) => evidenceId !== source.id)
        .map((evidenceId) =>
          makeEdge(
            "SOURCE_HAS_EVIDENCE_ID",
            `phase6:source:${source.id}`,
            `phase6:evidence-id:${slug(evidenceId)}`,
            { evidenceSourceId: evidenceId, createsNewScriptClaims: false },
            [evidenceId],
          ),
        ),
    ),
    ...Object.entries(LOCAL_SOURCE_FILES).map(([id]) =>
      makeEdge("SOURCE_HAS_LOCAL_FILE", "phase6:source:unicode-ucd", `phase6:local-source-file:${slug(id)}`, { ingested: true }, ["unicode-ucd"]),
    ),
    makeEdge("SOURCE_PARTIALLY_BACKS_ALIAS_CHECK", "phase6:source:iso-15924", "phase6:local-source-file:unicode-ucd-property-value-aliases", { ingested: "partial_via_ucd_aliases" }, ["iso-15924", "unicode-ucd"]),
    ...["cldr", "icu", "harfbuzz", "opentype-spec"].map((sourceId) =>
      makeEdge("SOURCE_BLOCKED_FOR_CLAIMS", `phase6:source:${sourceId}`, "phase6:artifact:conflict-detector", { reason: "No local authoritative snapshot is ingested." }, [sourceId]),
    ),
    makeEdge("LOCAL_FILES_DERIVE_PHASE3", "phase6:source:unicode-ucd", "phase6:artifact:crosswalk", { createsNewScriptClaims: false }, ["unicode-ucd"]),
    makeEdge("LOCAL_FILES_DERIVE_PHASE3", "phase6:source:unicode-ucd", "phase6:artifact:numeral", { createsNewScriptClaims: false }, ["unicode-ucd"]),
    makeEdge("LOCAL_FILES_DERIVE_PHASE3", "phase6:source:unicode-ucd", "phase6:artifact:zero", { createsNewScriptClaims: false }, ["unicode-ucd"]),
    makeEdge("PHASE3_DERIVES_KBS", "phase6:artifact:crosswalk", "phase6:artifact:kbs-graph", { createsNewScriptClaims: false }, ["unicode-ucd"]),
    makeEdge("PHASE3_DERIVES_KBS", "phase6:artifact:numeral", "phase6:artifact:kbs-graph", { createsNewScriptClaims: false }, ["unicode-ucd"]),
    makeEdge("PHASE3_DERIVES_KBS", "phase6:artifact:zero", "phase6:artifact:kbs-graph", { createsNewScriptClaims: false }, ["unicode-ucd"]),
    makeEdge("KBS_DERIVES_AUDIT_EXPORT", "phase6:artifact:kbs-graph", "phase6:artifact:audit", { createsNewScriptClaims: false }, sourceRefsInGraph.filter((sourceId) => registeredEvidenceIds.has(sourceId))),
    makeEdge("KBS_DERIVES_PROVENANCE", "phase6:artifact:kbs-graph", "phase6:artifact:provenance", { createsNewScriptClaims: false }, sourceRefsInGraph.filter((sourceId) => registeredEvidenceIds.has(sourceId))),
    makeEdge("AUDIT_DERIVES_FEDERATION", "phase6:artifact:audit", "phase6:artifact:source-registry", { createsNewScriptClaims: false }, sources.map((source) => source.id)),
    makeEdge("AUDIT_DERIVES_FEDERATION", "phase6:artifact:audit", "phase6:artifact:conflict-detector", { createsNewScriptClaims: false }, sources.map((source) => source.id)),
    makeEdge("PROVENANCE_DERIVES_CHAINS", "phase6:artifact:provenance", "phase6:artifact:provenance-chains", { createsNewScriptClaims: false }, sources.map((source) => source.id)),
  ];

  const lineageGraph = baseArtifact("hkd-lipi-evidence-lineage-graph.v1", {
    summary: {
      nodes: lineageNodes.length,
      edges: lineageEdges.length,
      byNodeType: countBy(lineageNodes, (node) => node.type),
      byEdgeType: countBy(lineageEdges, (edge) => edge.type),
      claimCreatingEdges: lineageEdges.filter((edge) => edge.fields.createsNewScriptClaims === true).length,
    },
    nodes: lineageNodes,
    edges: lineageEdges,
    provenance: provenance("evidence_lineage_graph", sources.map((source) => source.id)),
  });

  const unicodeRows = records.filter((record) => record.registry_class === "unicode");
  const crosswalkByScript = new Map(crosswalk.records.map((entry) => [entry.unicodeScriptValue, entry]));
  const seedCrosswalkMismatches = unicodeRows
    .filter((record) => {
      const entry = crosswalkByScript.get(record.unicode_script_value);
      return !entry || entry.iso15924 !== record.iso15924 || entry.unicodeScriptAlias !== record.unicode_script_alias;
    })
    .map((record) => record.id);

  const notIngestedComparisons = sources
    .filter((source) => source.localStatus === "NOT_INGESTED")
    .map((source) => ({
      sourceId: source.id,
      status: "BLOCKED_NO_LOCAL_SNAPSHOT",
      compared: false,
      reason: "Source is registered as authoritative, but no local snapshot is ingested, so it cannot validate or conflict with registry claims.",
      provenance: provenance("blocked_source_comparison", [source.id]),
    }));

  const conflicts = [
    ...seedCrosswalkMismatches.map((scriptId) => ({
      severity: "HIGH",
      type: "SEED_CROSSWALK_ALIAS_MISMATCH",
      scriptId,
      sources: ["unicode-ucd", "iso-15924"],
      provenance: provenance("source_conflict", ["unicode-ucd", "iso-15924"]),
    })),
  ];

  const conflictDetector = baseArtifact("hkd-lipi-source-conflict-detector.v1", {
    summary: {
      conflicts: conflicts.length,
      highSeverityConflicts: conflicts.filter((conflict) => conflict.severity === "HIGH").length,
      blockedComparisons: notIngestedComparisons.length,
      localComparisons: 3,
      newScriptClaimsCreated: 0,
    },
    checks: {
      noSeedCrosswalkAliasMismatches: seedCrosswalkMismatches.length === 0,
      noRuntimeEnabledTrue: records.every((record) => record.hkd_runtime_enabled === false),
      noProductionReadyTrue: kbsGraph.productionReady === false && audit.productionReady === false,
      noNonIngestedSourceCreatesClaims: sources.filter((source) => source.localStatus === "NOT_INGESTED").every((source) => source.createsNewScriptClaims === false),
      noLineageClaimCreatingEdges: lineageGraph.summary.claimCreatingEdges === 0,
      everyGraphSourceRefRegistered: sourceRefsInGraph.every((sourceId) => registeredEvidenceIds.has(sourceId)),
      cldrIcuHarfBuzzOpenTypeBlockedUntilIngested: notIngestedComparisons.length === 4,
    },
    localComparisons: [
      {
        id: "seed-vs-crosswalk-script-aliases",
        sources: ["unicode-ucd", "iso-15924"],
        comparedRows: unicodeRows.length,
        mismatches: seedCrosswalkMismatches,
        provenance: provenance("local_source_comparison", ["unicode-ucd", "iso-15924"]),
      },
      {
        id: "decimal-digit-inventory-vs-zero-registry",
        sources: ["unicode-ucd"],
        comparedRows: numeral.records.length,
        mismatches: numeral.records.filter((entry) => !zero.records.some((zeroEntry) => zeroEntry.scriptValue === entry.scriptValue && zeroEntry.zeroCodePoint === entry.zeroCodePoint)).map((entry) => entry.scriptValue),
        provenance: provenance("local_source_comparison", ["unicode-ucd"]),
      },
      {
        id: "kbs-provenance-vs-source-registry",
        sources: sources.map((source) => source.id),
        comparedRows: sourceRefsInGraph.length,
        mismatches: sourceRefsInGraph.filter((sourceId) => !registeredEvidenceIds.has(sourceId)),
        provenance: provenance("local_source_comparison", sources.flatMap((source) => source.evidenceSourceIds)),
      },
    ],
    blockedComparisons: notIngestedComparisons,
    conflicts,
    provenance: provenance("source_conflict_detector", sources.map((source) => source.id)),
  });

  const sourceChains = sources.map((source) => ({
    sourceId: source.id,
    label: source.displayName,
    localStatus: source.localStatus,
    createsNewScriptClaims: false,
    chain: lineageEdges
      .filter((edge) => edge.from === `phase6:source:${source.id}` || edge.sourceRefs.includes(source.id))
      .map((edge) => ({ edgeId: edge.id, type: edge.type, from: edge.from, to: edge.to })),
    provenance: provenance("source_provenance_chain", [source.id]),
  }));

  const scriptChains = records.map((record) => ({
    scriptId: record.id,
    kbsNodeId: record.kbs_node_id,
    displayName: record.display_name,
    sourceRefs: record.source_refs,
    sourceChainStatus: record.source_refs.every((sourceId) => registeredEvidenceIds.has(sourceId)) ? "COMPLETE" : "ORPHAN_SOURCE_REF",
    chain: [
      ...record.source_refs.map((sourceId) => ({
        from: sourceNodeByEvidenceId.get(sourceId) ?? `phase6:evidence-id:${slug(sourceId)}`,
        to: record.kbs_node_id,
        relation: "SOURCE_BACKS_SCRIPT_RECORD",
        evidenceSourceId: sourceId,
      })),
      {
        from: record.kbs_node_id,
        to: "phase6:artifact:kbs-graph",
        relation: "SCRIPT_RECORD_MATERIALIZED_IN_KBS",
      },
      {
        from: "phase6:artifact:kbs-graph",
        to: "phase6:artifact:audit",
        relation: "KBS_AUDITED",
      },
    ],
    provenance: provenance("script_provenance_chain", record.source_refs),
  }));

  const provenanceChains = baseArtifact("hkd-lipi-provenance-chain-explorer.v1", {
    summary: {
      sourceChains: sourceChains.length,
      scriptChains: scriptChains.length,
      completeScriptChains: scriptChains.filter((chain) => chain.sourceChainStatus === "COMPLETE").length,
      orphanScriptChains: scriptChains.filter((chain) => chain.sourceChainStatus !== "COMPLETE").length,
      createsNewScriptClaims: 0,
    },
    sourceChains,
    scriptChains,
    provenance: provenance("provenance_chain_explorer", sources.map((source) => source.id)),
  });

  const evidence = baseArtifact("hkd-lipi-registry-phase6-federation-evidence.v1", {
    artifacts: OUT,
    counts: {
      sources: sourceRegistry.summary.sources,
      lineageNodes: lineageGraph.summary.nodes,
      lineageEdges: lineageGraph.summary.edges,
      conflicts: conflictDetector.summary.conflicts,
      blockedComparisons: conflictDetector.summary.blockedComparisons,
      scriptChains: provenanceChains.summary.scriptChains,
    },
    checks: {
      requestedSourcesRegistered: ["unicode-ucd", "iso-15924", "cldr", "icu", "harfbuzz", "opentype-spec"].every((sourceId) => sourceIds.has(sourceId)),
      noNewScriptClaimsCreated: sources.every((source) => source.createsNewScriptClaims === false) && conflictDetector.summary.newScriptClaimsCreated === 0,
      noRuntimeEnabledTrue: records.every((record) => record.hkd_runtime_enabled === false),
      noProductionReadyTrue: PRODUCTION_READY === false && kbsGraph.productionReady === false && audit.productionReady === false,
      everyGraphSourceRefRegistered: conflictDetector.checks.everyGraphSourceRefRegistered,
      allScriptChainsComplete: provenanceChains.summary.orphanScriptChains === 0,
      nonIngestedSourcesBlockedForClaims: conflictDetector.checks.cldrIcuHarfBuzzOpenTypeBlockedUntilIngested,
      noLineageClaimCreatingEdges: conflictDetector.checks.noLineageClaimCreatingEdges,
      noHighSeverityConflicts: conflictDetector.summary.highSeverityConflicts === 0,
    },
    limitations: [
      "CLDR, ICU, HarfBuzz, and OpenType are registered as authoritative future federation sources but are not locally ingested.",
      "ISO 15924 is only partially cross-checked through UCD PropertyValueAliases; no standalone ISO 15924 code-list snapshot is locally ingested.",
      "No external source in Phase 6 creates new script rows, Unicode assignments, ISO assignments, font support claims, shaping claims, or runtime enablement.",
    ],
    provenance: provenance("phase6_federation_evidence", sources.map((source) => source.id)),
  });

  writeFileSync(OUT.sourceRegistry, `${JSON.stringify(sourceRegistry, null, 2)}\n`);
  writeFileSync(OUT.lineageGraph, `${JSON.stringify(lineageGraph, null, 2)}\n`);
  writeFileSync(OUT.conflictDetector, `${JSON.stringify(conflictDetector, null, 2)}\n`);
  writeFileSync(OUT.provenanceChains, `${JSON.stringify(provenanceChains, null, 2)}\n`);
  writeFileSync(OUT.evidence, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ counts: evidence.counts, checks: evidence.checks }, null, 2));
}

main();
