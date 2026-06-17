import seedDataset from "../../data/hkd-lipi-script-registry-seed-426.json" with { type: "json" };
import architecture from "../../data/hkd-lipi-registry-architecture.json" with { type: "json" };
import numeralRegistry from "../../data/hkd-lipi-numeral-registry.json" with { type: "json" };
import zeroRegistry from "../../data/hkd-lipi-zero-registry.json" with { type: "json" };
import familyGraph from "../../data/hkd-lipi-script-family-graph.json" with { type: "json" };
import unicodeCrosswalk from "../../data/hkd-lipi-unicode-crosswalk.json" with { type: "json" };
import kbsGraph from "../../data/hkd-lipi-kbs-graph.json" with { type: "json" };
import auditReport from "../../release/evidence/hkd-lipi-registry-audit-report.json" with { type: "json" };
import provenanceReport from "../../release/evidence/hkd-lipi-registry-provenance-report.json" with { type: "json" };
import sourceRegistry from "../../data/hkd-lipi-federated-source-registry.json" with { type: "json" };
import evidenceLineageGraph from "../../data/hkd-lipi-evidence-lineage-graph.json" with { type: "json" };
import sourceConflictDetector from "../../data/hkd-lipi-source-conflict-detector.json" with { type: "json" };
import provenanceChainExplorer from "../../data/hkd-lipi-provenance-chain-explorer.json" with { type: "json" };
import federationEvidence from "../../release/evidence/hkd-lipi-registry-phase6-federation.json" with { type: "json" };
import sourceAdapterContracts from "../../data/hkd-lipi-source-adapter-contracts.json" with { type: "json" };
import ingestionPolicy from "../../data/hkd-lipi-ingestion-policy.json" with { type: "json" };
import sourceTrustMatrix from "../../data/hkd-lipi-source-trust-matrix.json" with { type: "json" };
import conflictResolutionRules from "../../data/hkd-lipi-conflict-resolution-rules.json" with { type: "json" };
import ingestionContractsEvidence from "../../release/evidence/hkd-lipi-registry-phase7-ingestion-contracts.json" with { type: "json" };
import ingestionDryRunReport from "../../data/hkd-lipi-ingestion-dry-run-report.json" with { type: "json" };
import ingestionFieldDiffPreview from "../../data/hkd-lipi-ingestion-field-diff-preview.json" with { type: "json" };
import ingestionBlockers from "../../data/hkd-lipi-ingestion-blockers.json" with { type: "json" };
import dryRunIngestionEvidence from "../../release/evidence/hkd-lipi-registry-phase8-dry-run-ingestion.json" with { type: "json" };
import iso15924IngestionReport from "../../data/iso15924-ingestion-report.json" with { type: "json" };
import iso15924ScriptCodeCrosswalk from "../../data/iso15924-script-code-crosswalk.json" with { type: "json" };
import iso15924DiffPreview from "../../data/iso15924-diff-preview.json" with { type: "json" };
import iso15924Blockers from "../../data/iso15924-blockers.json" with { type: "json" };
import iso15924IngestionEvidence from "../../release/evidence/hkd-lipi-registry-phase9-iso15924-ingestion.json" with { type: "json" };
import type { HkdLipiScriptRegistryRecord } from "../../packages/lipi-runtime/src/registry/hkd-lipi-registry-types.ts";

export type LipiRegistryApiStatus = "CONTROLLED_NO_GO";
export type LipiRegistryBadgeTone = "verified" | "blocked" | "draft" | "unknown" | "neutral";

export type LipiRegistryBadge = {
  label: string;
  value: string;
  tone: LipiRegistryBadgeTone;
};

export type LipiRegistryListQuery = {
  q?: string;
  registryClass?: string | "all";
  unicodeStatus?: string | "all";
  evidenceStatus?: string | "all";
  scriptFamily?: string | "all";
  limit?: number;
};

export type LipiRegistryStats = {
  total: number;
  byClass: Record<string, number>;
  byUnicodeStatus: Record<string, number>;
  byEvidenceStatus: Record<string, number>;
  runtimeEnabled: number;
  rowsWithUnicodeRanges: number;
  rowsWithKnownZeroGlyph: number;
  rowsWithDigitInventory: number;
  kbsNodes: number;
  kbsEdges: number;
};

export type LipiRegistryListResponse = {
  ok: true;
  reviewState: LipiRegistryApiStatus;
  governedProductionGo: false;
  productionReady: false;
  total: number;
  returned: number;
  stats: LipiRegistryStats;
  records: HkdLipiScriptRegistryRecord[];
};

export type LipiRegistryRecordResponse =
  | {
      ok: true;
      reviewState: LipiRegistryApiStatus;
      governedProductionGo: false;
      productionReady: false;
      record: HkdLipiScriptRegistryRecord;
      badges: LipiRegistryBadge[];
      relatedRecords: HkdLipiScriptRegistryRecord[];
      apiLinks: Array<{ label: string; path: string }>;
    }
  | {
      ok: false;
      reviewState: LipiRegistryApiStatus;
      governedProductionGo: false;
      productionReady: false;
      error: "SCRIPT_NOT_FOUND";
      id: string;
    };

export type LipiNumeralZeroView = {
  ok: true;
  reviewState: LipiRegistryApiStatus;
  governedProductionGo: false;
  productionReady: false;
  summary: {
    total: number;
    rowsWithKnownZeroGlyph: number;
    rowsWithDigitInventory: number;
    rowsWithDecimalDigitsTrue: number;
    rowsStillUnknown: number;
  };
  rows: Array<{
    id: string;
    displayName: string;
    zeroGlyph: string;
    zeroCodePoint: string;
    digits: Array<{ value: number; glyph: string; codePoint: string; name: string; blockName: string }>;
    hasDecimalDigits: boolean;
    numeralSystemType: string;
    evidenceStatus: string;
    sourceRefs: string[];
  }>;
};

export type LipiUnicodeCrosswalkResponse = {
  ok: true;
  reviewState: LipiRegistryApiStatus;
  governedProductionGo: false;
  productionReady: false;
  total: number;
  rows: Array<{
    id: string;
    displayName: string;
    unicodeScriptValue: string;
    unicodeScriptAlias: string;
    iso15924: string;
    unicodeBlocks: Array<{ blockName: string; range: string; start: string; end: string }>;
    unicodeRanges: string[];
    scriptPropertyKind: string;
    evidenceStatus: string;
    fontSupportStatus: string;
    transliterationStatus: string;
  }>;
};

export type LipiFamilyGraphView = {
  ok: true;
  reviewState: LipiRegistryApiStatus;
  governedProductionGo: false;
  productionReady: false;
  summary: typeof familyGraph.summary;
  scriptNodes: typeof familyGraph.nodes.scripts;
  blockNodes: typeof familyGraph.nodes.blocks;
  scriptBlockEdges: typeof familyGraph.edges.scriptBlockEdges;
  genealogicalFamilyEdges: typeof familyGraph.edges.genealogicalFamilyEdges;
  blockedGenealogicalFamilyRelationships: typeof familyGraph.edges.blockedGenealogicalFamilyRelationships;
};

export type LipiKbsNode = (typeof kbsGraph.nodes)[number];
export type LipiKbsEdge = (typeof kbsGraph.edges)[number];

export type LipiKbsGraphView = {
  ok: true;
  reviewState: LipiRegistryApiStatus;
  governedProductionGo: false;
  productionReady: false;
  phkdVerdict: "CONTROLLED_NO_GO";
  summary: typeof kbsGraph.summary;
  nodes: readonly LipiKbsNode[];
  edges: readonly LipiKbsEdge[];
};

export type LipiKbsScriptNeighborhood = {
  ok: true;
  reviewState: LipiRegistryApiStatus;
  governedProductionGo: false;
  productionReady: false;
  phkdVerdict: "CONTROLLED_NO_GO";
  record: HkdLipiScriptRegistryRecord;
  scriptNode: LipiKbsNode | null;
  edges: LipiKbsEdge[];
  neighbors: LipiKbsNode[];
  blockedFields: typeof kbsGraph.summary.blockedFields;
  summary: {
    edgeCount: number;
    neighborCount: number;
    byEdgeType: Record<string, number>;
  };
};

export type LipiRegistryAuditabilityView = {
  ok: true;
  reviewState: LipiRegistryApiStatus;
  governedProductionGo: false;
  productionReady: false;
  phkdVerdict: "CONTROLLED_NO_GO";
  exportCenter: {
    artifactPaths: typeof auditReport.artifactPaths;
    outputHashes: typeof auditReport.outputHashes;
  };
  evidenceAudit: {
    schema: typeof auditReport.schema;
    inputCounts: typeof auditReport.inputCounts;
    checks: typeof auditReport.checks;
    failures: typeof auditReport.failures;
  };
  provenance: {
    schema: typeof provenanceReport.schema;
    counts: typeof provenanceReport.counts;
    evidenceSources: typeof provenanceReport.evidenceSources;
    orphanEvidenceReferences: typeof provenanceReport.orphanEvidenceReferences;
    nodesMissingProvenance: typeof provenanceReport.nodesMissingProvenance;
    edgesMissingProvenance: typeof provenanceReport.edgesMissingProvenance;
    nodesUnreachableFromProvenance: typeof provenanceReport.nodesUnreachableFromProvenance;
  };
  validator: {
    graphSummary: typeof kbsGraph.summary;
    checks: typeof auditReport.checks;
    failures: typeof auditReport.failures;
  };
  registryDiff: typeof auditReport.registryDiff;
};

export type LipiEvidenceFederationView = {
  ok: true;
  reviewState: LipiRegistryApiStatus;
  governedProductionGo: false;
  productionReady: false;
  phkdVerdict: "CONTROLLED_NO_GO";
  sourceRegistry: {
    summary: typeof sourceRegistry.summary;
    sources: typeof sourceRegistry.sources;
  };
  lineageGraph: {
    summary: typeof evidenceLineageGraph.summary;
    nodes: typeof evidenceLineageGraph.nodes;
    edges: typeof evidenceLineageGraph.edges;
  };
  conflictDetector: {
    summary: typeof sourceConflictDetector.summary;
    checks: typeof sourceConflictDetector.checks;
    localComparisons: typeof sourceConflictDetector.localComparisons;
    blockedComparisons: typeof sourceConflictDetector.blockedComparisons;
    conflicts: typeof sourceConflictDetector.conflicts;
  };
  provenanceChains: {
    summary: typeof provenanceChainExplorer.summary;
    sourceChains: typeof provenanceChainExplorer.sourceChains;
    scriptChains: typeof provenanceChainExplorer.scriptChains;
  };
  evidence: {
    counts: typeof federationEvidence.counts;
    checks: typeof federationEvidence.checks;
    limitations: typeof federationEvidence.limitations;
  };
};

export type LipiSourceIngestionContractsView = {
  ok: true;
  reviewState: LipiRegistryApiStatus;
  governedProductionGo: false;
  productionReady: false;
  phkdVerdict: "CONTROLLED_NO_GO";
  adapterContracts: {
    summary: typeof sourceAdapterContracts.summary;
    adapters: typeof sourceAdapterContracts.adapters;
  };
  ingestionPolicy: {
    policyId: typeof ingestionPolicy.policyId;
    adapterMode: typeof ingestionPolicy.adapterMode;
    allowedAdapterFieldStatuses: typeof ingestionPolicy.allowedAdapterFieldStatuses;
    allowedActions: typeof ingestionPolicy.allowedActions;
    forbiddenActions: typeof ingestionPolicy.forbiddenActions;
    fieldTransitionPolicy: typeof ingestionPolicy.fieldTransitionPolicy;
    adapterSummary: typeof ingestionPolicy.adapterSummary;
  };
  trustMatrix: {
    summary: typeof sourceTrustMatrix.summary;
    rows: typeof sourceTrustMatrix.rows;
  };
  conflictRules: {
    summary: typeof conflictResolutionRules.summary;
    rules: typeof conflictResolutionRules.rules;
  };
  evidence: {
    counts: typeof ingestionContractsEvidence.counts;
    checks: typeof ingestionContractsEvidence.checks;
    limitations: typeof ingestionContractsEvidence.limitations;
  };
};

export type LipiIngestionDryRunView = {
  ok: true;
  reviewState: LipiRegistryApiStatus;
  governedProductionGo: false;
  productionReady: false;
  phkdVerdict: "CONTROLLED_NO_GO";
  dryRunReport: {
    dryRun: typeof ingestionDryRunReport.dryRun;
    policySnapshot: typeof ingestionDryRunReport.policySnapshot;
    adapterRuns: typeof ingestionDryRunReport.adapterRuns;
  };
  fieldDiffPreview: {
    summary: typeof ingestionFieldDiffPreview.summary;
    previews: typeof ingestionFieldDiffPreview.previews;
  };
  blockers: {
    summary: typeof ingestionBlockers.summary;
    conflictPromotionPolicy: typeof ingestionBlockers.conflictPromotionPolicy;
    blockers: typeof ingestionBlockers.blockers;
  };
  evidence: {
    counts: typeof dryRunIngestionEvidence.counts;
    checks: typeof dryRunIngestionEvidence.checks;
    limitations: typeof dryRunIngestionEvidence.limitations;
  };
};

export type LipiIso15924IngestionView = {
  ok: true;
  reviewState: LipiRegistryApiStatus;
  governedProductionGo: false;
  productionReady: false;
  phkdVerdict: "CONTROLLED_NO_GO";
  report: {
    ingestion: typeof iso15924IngestionReport.ingestion;
    summary: typeof iso15924IngestionReport.summary;
    officialSource: typeof iso15924IngestionReport.officialSource;
  };
  crosswalk: {
    summary: typeof iso15924ScriptCodeCrosswalk.summary;
    rows: typeof iso15924ScriptCodeCrosswalk.rows;
  };
  diffPreview: {
    summary: typeof iso15924DiffPreview.summary;
    diffs: typeof iso15924DiffPreview.diffs;
  };
  blockers: {
    summary: typeof iso15924Blockers.summary;
    conflictPromotionPolicy: typeof iso15924Blockers.conflictPromotionPolicy;
    blockers: typeof iso15924Blockers.blockers;
  };
  evidence: {
    counts: typeof iso15924IngestionEvidence.counts;
    checks: typeof iso15924IngestionEvidence.checks;
    limitations: typeof iso15924IngestionEvidence.limitations;
  };
};

export type LipiPhase3ScriptEnrichment = {
  crosswalk: (typeof unicodeCrosswalk.records)[number] | null;
  numeral: (typeof numeralRegistry.records)[number] | null;
  zero: (typeof zeroRegistry.records)[number] | null;
};

export const HKD_LIPI_REGISTRY_API_CONTRACTS = [
  {
    method: "GET",
    path: "/api/lipi-registry/scripts",
    handler: "listLipiRegistryScripts",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/scripts/{id}",
    handler: "getLipiRegistryScript",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/unicode/crosswalk",
    handler: "getLipiUnicodeCrosswalk",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/numerals-zero",
    handler: "getLipiNumeralZeroView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/phase3/family-graph",
    handler: "getLipiFamilyGraphView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/kbs/graph",
    handler: "getLipiKbsGraphView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/scripts/{id}/kbs",
    handler: "getLipiScriptKbsNeighborhood",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/export-center",
    handler: "getLipiRegistryAuditabilityView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/audit",
    handler: "getLipiRegistryAuditabilityView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/provenance",
    handler: "getLipiRegistryAuditabilityView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/validator",
    handler: "getLipiRegistryAuditabilityView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/diff",
    handler: "getLipiRegistryAuditabilityView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/federation/sources",
    handler: "getLipiEvidenceFederationView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/federation/lineage",
    handler: "getLipiEvidenceFederationView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/federation/conflicts",
    handler: "getLipiEvidenceFederationView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/federation/provenance-chains",
    handler: "getLipiEvidenceFederationView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/contracts",
    handler: "getLipiSourceIngestionContractsView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/policy",
    handler: "getLipiSourceIngestionContractsView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/trust-matrix",
    handler: "getLipiSourceIngestionContractsView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/conflict-rules",
    handler: "getLipiSourceIngestionContractsView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/dry-run",
    handler: "getLipiIngestionDryRunView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/field-diff-preview",
    handler: "getLipiIngestionDryRunView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/blockers",
    handler: "getLipiIngestionDryRunView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/iso15924/report",
    handler: "getLipiIso15924IngestionView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/iso15924/crosswalk",
    handler: "getLipiIso15924IngestionView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/iso15924/diff-preview",
    handler: "getLipiIso15924IngestionView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/iso15924/blockers",
    handler: "getLipiIso15924IngestionView",
    status: "LOCAL_CONTRACT",
  },
] as const;

const records = Object.freeze((seedDataset.records as HkdLipiScriptRegistryRecord[]).map((record) => Object.freeze(record)));
const kbsNodes: readonly LipiKbsNode[] = Object.freeze((kbsGraph.nodes as LipiKbsNode[]).map((node: LipiKbsNode) => Object.freeze(node)));
const kbsEdges: readonly LipiKbsEdge[] = Object.freeze((kbsGraph.edges as LipiKbsEdge[]).map((edge: LipiKbsEdge) => Object.freeze(edge)));
const kbsNodeById = new Map<string, LipiKbsNode>(kbsNodes.map((node) => [node.id, node]));

export function getLipiRegistryRecords(): readonly HkdLipiScriptRegistryRecord[] {
  return records;
}

export function getLipiRegistryStats(sourceRecords: readonly HkdLipiScriptRegistryRecord[] = records): LipiRegistryStats {
  return {
    total: sourceRecords.length,
    byClass: countBy(sourceRecords, (record) => record.registry_class),
    byUnicodeStatus: countBy(sourceRecords, (record) => record.unicode_status),
    byEvidenceStatus: countBy(sourceRecords, (record) => record.evidence_status),
    runtimeEnabled: sourceRecords.filter((record) => record.hkd_runtime_enabled).length,
    rowsWithUnicodeRanges: unicodeCrosswalk.summary.rowsWithRanges,
    rowsWithKnownZeroGlyph: zeroRegistry.summary.zeroGlyphScripts,
    rowsWithDigitInventory: numeralRegistry.summary.completeDigitSetScripts,
    kbsNodes: kbsGraph.summary.totalNodes,
    kbsEdges: kbsGraph.summary.totalEdges,
  };
}

export function listLipiRegistryScripts(query: LipiRegistryListQuery = {}): LipiRegistryListResponse {
  const words = normalizeWords(query.q ?? "");
  const limit = Math.max(1, Math.min(query.limit ?? 80, 426));
  const filtered = records.filter((record) => matchesQuery(record, words, query));
  const sorted = filtered.sort((a, b) => scoreRecord(b, words) - scoreRecord(a, words) || a.registry_index - b.registry_index);
  const resultRecords = sorted.slice(0, limit);

  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    total: filtered.length,
    returned: resultRecords.length,
    stats: getLipiRegistryStats(records),
    records: resultRecords,
  };
}

export function getLipiRegistryScript(id: string): LipiRegistryRecordResponse {
  const record = records.find((candidate) => candidate.id === id);
  if (!record) {
    return {
      ok: false,
      reviewState: "CONTROLLED_NO_GO",
      governedProductionGo: false,
      productionReady: false,
      error: "SCRIPT_NOT_FOUND",
      id,
    };
  }

  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    record,
    badges: getLipiEvidenceBadges(record),
    relatedRecords: records
      .filter((candidate) => candidate.id !== record.id && candidate.script_family === record.script_family)
      .slice(0, 8),
    apiLinks: HKD_LIPI_REGISTRY_API_CONTRACTS.map((contract) => ({
      label: `${contract.method} ${contract.path}`,
      path: contract.path.replace("{id}", record.id),
    })),
  };
}

export function getLipiUnicodeCrosswalk(): LipiUnicodeCrosswalkResponse {
  const rows = unicodeCrosswalk.records.map((record) => ({
    id: `unicode-${slug(record.unicodeScriptValue)}`,
    displayName: record.unicodeScriptValue.replace(/_/g, " "),
    unicodeScriptValue: record.unicodeScriptValue,
    unicodeScriptAlias: record.unicodeScriptAlias,
    iso15924: record.iso15924,
    unicodeBlocks: record.unicodeBlocks,
    unicodeRanges: record.unicodeRanges,
    scriptPropertyKind: record.scriptPropertyKind,
    evidenceStatus: "verified",
    fontSupportStatus: record.fontSupportMetadata.status,
    transliterationStatus: record.transliterationMetadata.status,
  }));

  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    total: rows.length,
    rows,
  };
}

export function getLipiNumeralZeroView(): LipiNumeralZeroView {
  const zeroByScript = new Map(zeroRegistry.records.map((entry) => [entry.scriptValue, entry]));
  const rows = numeralRegistry.records.map((record) => {
    const zero = zeroByScript.get(record.scriptValue);
    return {
      id: `unicode-${slug(record.scriptValue)}`,
      displayName: record.scriptValue.replace(/_/g, " "),
      zeroGlyph: zero?.zeroGlyph ?? record.zeroGlyph,
      zeroCodePoint: zero?.zeroCodePoint ?? record.zeroCodePoint,
      digits: record.digits_0_9,
      hasDecimalDigits: record.allValuesPresent,
      numeralSystemType: "decimal",
      evidenceStatus: "verified",
      sourceRefs: record.sourceRefs,
    };
  });
  const rowsWithKnownZeroGlyph = rows.filter((row) => row.zeroGlyph !== "UNKNOWN").length;
  const rowsWithDigitInventory = rows.filter((row) => row.digits.length === 10).length;
  const rowsWithDecimalDigitsTrue = rows.filter((row) => row.hasDecimalDigits === true).length;

  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    summary: {
      total: rows.length,
      rowsWithKnownZeroGlyph,
      rowsWithDigitInventory,
      rowsWithDecimalDigitsTrue,
      rowsStillUnknown: rows.length - new Set(rows.filter((row) => row.zeroGlyph !== "UNKNOWN" || row.digits.length > 0 || row.hasDecimalDigits === true).map((row) => row.id)).size,
    },
    rows,
  };
}

export function getLipiZeroRegistryView() {
  return {
    ok: true as const,
    reviewState: "CONTROLLED_NO_GO" as const,
    governedProductionGo: false as const,
    productionReady: false as const,
    summary: zeroRegistry.summary,
    records: zeroRegistry.records,
  };
}

export function getLipiFamilyGraphView(): LipiFamilyGraphView {
  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    summary: familyGraph.summary,
    scriptNodes: familyGraph.nodes.scripts,
    blockNodes: familyGraph.nodes.blocks,
    scriptBlockEdges: familyGraph.edges.scriptBlockEdges,
    genealogicalFamilyEdges: familyGraph.edges.genealogicalFamilyEdges,
    blockedGenealogicalFamilyRelationships: familyGraph.edges.blockedGenealogicalFamilyRelationships,
  };
}

export function getLipiKbsGraphView(): LipiKbsGraphView {
  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    phkdVerdict: "CONTROLLED_NO_GO",
    summary: kbsGraph.summary,
    nodes: kbsNodes,
    edges: kbsEdges,
  };
}

export function getLipiScriptKbsNeighborhood(scriptId: string): LipiKbsScriptNeighborhood | null {
  const record = records.find((candidate) => candidate.id === scriptId);
  if (!record) return null;
  const scriptNode = kbsNodeById.get(record.kbs_node_id) ?? null;
  const edges = kbsEdges.filter((edge: LipiKbsEdge) => edge.from === record.kbs_node_id || edge.to === record.kbs_node_id);
  const neighbors = edges
    .map((edge) => (edge.from === record.kbs_node_id ? edge.to : edge.from))
    .map((nodeId) => kbsNodeById.get(nodeId))
    .filter((node): node is LipiKbsNode => Boolean(node));

  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    phkdVerdict: "CONTROLLED_NO_GO",
    record,
    scriptNode,
    edges,
    neighbors,
    blockedFields: kbsGraph.summary.blockedFields,
    summary: {
      edgeCount: edges.length,
      neighborCount: neighbors.length,
      byEdgeType: countBy(edges, (edge) => edge.type),
    },
  };
}

export function getLipiRegistryAuditabilityView(): LipiRegistryAuditabilityView {
  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    phkdVerdict: "CONTROLLED_NO_GO",
    exportCenter: {
      artifactPaths: auditReport.artifactPaths,
      outputHashes: auditReport.outputHashes,
    },
    evidenceAudit: {
      schema: auditReport.schema,
      inputCounts: auditReport.inputCounts,
      checks: auditReport.checks,
      failures: auditReport.failures,
    },
    provenance: {
      schema: provenanceReport.schema,
      counts: provenanceReport.counts,
      evidenceSources: provenanceReport.evidenceSources,
      orphanEvidenceReferences: provenanceReport.orphanEvidenceReferences,
      nodesMissingProvenance: provenanceReport.nodesMissingProvenance,
      edgesMissingProvenance: provenanceReport.edgesMissingProvenance,
      nodesUnreachableFromProvenance: provenanceReport.nodesUnreachableFromProvenance,
    },
    validator: {
      graphSummary: kbsGraph.summary,
      checks: auditReport.checks,
      failures: auditReport.failures,
    },
    registryDiff: auditReport.registryDiff,
  };
}

export function getLipiEvidenceFederationView(): LipiEvidenceFederationView {
  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    phkdVerdict: "CONTROLLED_NO_GO",
    sourceRegistry: {
      summary: sourceRegistry.summary,
      sources: sourceRegistry.sources,
    },
    lineageGraph: {
      summary: evidenceLineageGraph.summary,
      nodes: evidenceLineageGraph.nodes,
      edges: evidenceLineageGraph.edges,
    },
    conflictDetector: {
      summary: sourceConflictDetector.summary,
      checks: sourceConflictDetector.checks,
      localComparisons: sourceConflictDetector.localComparisons,
      blockedComparisons: sourceConflictDetector.blockedComparisons,
      conflicts: sourceConflictDetector.conflicts,
    },
    provenanceChains: {
      summary: provenanceChainExplorer.summary,
      sourceChains: provenanceChainExplorer.sourceChains,
      scriptChains: provenanceChainExplorer.scriptChains,
    },
    evidence: {
      counts: federationEvidence.counts,
      checks: federationEvidence.checks,
      limitations: federationEvidence.limitations,
    },
  };
}

export function getLipiSourceIngestionContractsView(): LipiSourceIngestionContractsView {
  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    phkdVerdict: "CONTROLLED_NO_GO",
    adapterContracts: {
      summary: sourceAdapterContracts.summary,
      adapters: sourceAdapterContracts.adapters,
    },
    ingestionPolicy: {
      policyId: ingestionPolicy.policyId,
      adapterMode: ingestionPolicy.adapterMode,
      allowedAdapterFieldStatuses: ingestionPolicy.allowedAdapterFieldStatuses,
      allowedActions: ingestionPolicy.allowedActions,
      forbiddenActions: ingestionPolicy.forbiddenActions,
      fieldTransitionPolicy: ingestionPolicy.fieldTransitionPolicy,
      adapterSummary: ingestionPolicy.adapterSummary,
    },
    trustMatrix: {
      summary: sourceTrustMatrix.summary,
      rows: sourceTrustMatrix.rows,
    },
    conflictRules: {
      summary: conflictResolutionRules.summary,
      rules: conflictResolutionRules.rules,
    },
    evidence: {
      counts: ingestionContractsEvidence.counts,
      checks: ingestionContractsEvidence.checks,
      limitations: ingestionContractsEvidence.limitations,
    },
  };
}

export function getLipiIngestionDryRunView(): LipiIngestionDryRunView {
  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    phkdVerdict: "CONTROLLED_NO_GO",
    dryRunReport: {
      dryRun: ingestionDryRunReport.dryRun,
      policySnapshot: ingestionDryRunReport.policySnapshot,
      adapterRuns: ingestionDryRunReport.adapterRuns,
    },
    fieldDiffPreview: {
      summary: ingestionFieldDiffPreview.summary,
      previews: ingestionFieldDiffPreview.previews,
    },
    blockers: {
      summary: ingestionBlockers.summary,
      conflictPromotionPolicy: ingestionBlockers.conflictPromotionPolicy,
      blockers: ingestionBlockers.blockers,
    },
    evidence: {
      counts: dryRunIngestionEvidence.counts,
      checks: dryRunIngestionEvidence.checks,
      limitations: dryRunIngestionEvidence.limitations,
    },
  };
}

export function getLipiIso15924IngestionView(): LipiIso15924IngestionView {
  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    phkdVerdict: "CONTROLLED_NO_GO",
    report: {
      ingestion: iso15924IngestionReport.ingestion,
      summary: iso15924IngestionReport.summary,
      officialSource: iso15924IngestionReport.officialSource,
    },
    crosswalk: {
      summary: iso15924ScriptCodeCrosswalk.summary,
      rows: iso15924ScriptCodeCrosswalk.rows,
    },
    diffPreview: {
      summary: iso15924DiffPreview.summary,
      diffs: iso15924DiffPreview.diffs,
    },
    blockers: {
      summary: iso15924Blockers.summary,
      conflictPromotionPolicy: iso15924Blockers.conflictPromotionPolicy,
      blockers: iso15924Blockers.blockers,
    },
    evidence: {
      counts: iso15924IngestionEvidence.counts,
      checks: iso15924IngestionEvidence.checks,
      limitations: iso15924IngestionEvidence.limitations,
    },
  };
}

export function getLipiPhase3ScriptEnrichment(record: HkdLipiScriptRegistryRecord): LipiPhase3ScriptEnrichment {
  const scriptValue = record.unicode_script_value;
  if (scriptValue === "UNKNOWN") {
    return { crosswalk: null, numeral: null, zero: null };
  }
  return {
    crosswalk: unicodeCrosswalk.records.find((entry) => entry.unicodeScriptValue === scriptValue) ?? null,
    numeral: numeralRegistry.records.find((entry) => entry.scriptValue === scriptValue) ?? null,
    zero: zeroRegistry.records.find((entry) => entry.scriptValue === scriptValue) ?? null,
  };
}

export function getLipiEvidenceBadges(record: HkdLipiScriptRegistryRecord): LipiRegistryBadge[] {
  return [
    { label: "Evidence", value: record.evidence_status, tone: badgeToneForEvidence(record.evidence_status) },
    { label: "Unicode", value: record.unicode_status, tone: record.unicode_status === "encoded" ? "verified" : record.unicode_status === "unencoded" ? "blocked" : "draft" },
    { label: "Runtime", value: record.hkd_runtime_enabled ? "ENABLED" : "DISABLED", tone: record.hkd_runtime_enabled ? "verified" : "blocked" },
    { label: "ISO 15924", value: record.iso15924, tone: record.iso15924 === "UNKNOWN" ? "unknown" : "verified" },
    { label: "Sources", value: `${record.source_refs.length}`, tone: record.source_refs.length > 0 ? "neutral" : "blocked" },
  ];
}

export function getLipiRegistrySourceSummary() {
  return {
    architectureSchema: architecture.schema,
    seedSchema: seedDataset.schema,
    phase3Schemas: {
      numeral: numeralRegistry.schema,
      zero: zeroRegistry.schema,
      family: familyGraph.schema,
      crosswalk: unicodeCrosswalk.schema,
      kbs: kbsGraph.schema,
      audit: auditReport.schema,
      provenance: provenanceReport.schema,
      federationSources: sourceRegistry.schema,
      federationLineage: evidenceLineageGraph.schema,
      federationConflicts: sourceConflictDetector.schema,
      federationChains: provenanceChainExplorer.schema,
      adapterContracts: sourceAdapterContracts.schema,
      ingestionPolicy: ingestionPolicy.schema,
      trustMatrix: sourceTrustMatrix.schema,
      conflictRules: conflictResolutionRules.schema,
      ingestionDryRun: ingestionDryRunReport.schema,
      fieldDiffPreview: ingestionFieldDiffPreview.schema,
      ingestionBlockers: ingestionBlockers.schema,
      iso15924Ingestion: iso15924IngestionReport.schema,
      iso15924Crosswalk: iso15924ScriptCodeCrosswalk.schema,
      iso15924DiffPreview: iso15924DiffPreview.schema,
      iso15924Blockers: iso15924Blockers.schema,
    },
    sourceRefs: seedDataset.sourceRefs,
    phase3SourcePolicy: "official_unicode_ucd_only",
    phase4SourcePolicy: "hkd_registry_seed_plus_phase3_ucd_artifacts_only",
    phase6SourcePolicy: "cross_reference_only_no_new_script_claims",
    phase7SourcePolicy: "adapter_contracts_only_no_ingestion_no_silent_enrichment",
    phase8SourcePolicy: "dry_run_only_no_registry_mutation_no_enrichment",
    phase9SourcePolicy: "iso15924_official_source_only_preview_no_registry_mutation",
    contracts: HKD_LIPI_REGISTRY_API_CONTRACTS,
    reviewState: "CONTROLLED_NO_GO" as const,
    governedProductionGo: false as const,
    productionReady: false as const,
  };
}

function matchesQuery(record: HkdLipiScriptRegistryRecord, words: string[], query: LipiRegistryListQuery): boolean {
  if (query.registryClass && query.registryClass !== "all" && record.registry_class !== query.registryClass) return false;
  if (query.unicodeStatus && query.unicodeStatus !== "all" && record.unicode_status !== query.unicodeStatus) return false;
  if (query.evidenceStatus && query.evidenceStatus !== "all" && record.evidence_status !== query.evidenceStatus) return false;
  if (query.scriptFamily && query.scriptFamily !== "all" && record.script_family !== query.scriptFamily) return false;
  if (words.length === 0) return true;
  const haystack = [
    record.id,
    record.display_name,
    record.native_name,
    record.registry_class,
    record.script_family,
    record.unicode_script_value,
    record.unicode_script_alias,
    record.iso15924,
    record.unicode_status,
    record.evidence_status,
    record.cultural_status,
    record.script_property_kind,
    record.region_primary,
    ...record.alternate_names,
    ...record.regions,
    ...record.languages,
    ...record.unicode_blocks,
    ...record.unicode_ranges,
    ...record.source_refs,
  ]
    .join(" ")
    .toLowerCase();
  return words.every((word) => haystack.includes(word));
}

function scoreRecord(record: HkdLipiScriptRegistryRecord, words: string[]): number {
  if (words.length === 0) {
    if (record.registry_class === "unicode") return 4;
    if (record.evidence_status === "verified") return 3;
    if (record.evidence_status === "unknown") return 1;
    return 2;
  }
  const title = record.display_name.toLowerCase();
  const id = record.id.toLowerCase();
  return words.reduce((score, word) => score + (title.includes(word) ? 8 : id.includes(word) ? 5 : record.unicode_blocks.some((block) => block.toLowerCase().includes(word)) ? 3 : 1), 0);
}

function normalizeWords(value: string): string[] {
  return value.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function countBy<T>(items: readonly T[], selectKey: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = selectKey(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function badgeToneForEvidence(evidenceStatus: string): LipiRegistryBadgeTone {
  if (evidenceStatus === "verified") return "verified";
  if (evidenceStatus === "disputed") return "blocked";
  if (evidenceStatus === "draft" || evidenceStatus === "scholarly") return "draft";
  if (evidenceStatus === "unknown") return "unknown";
  return "neutral";
}

function slug(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
