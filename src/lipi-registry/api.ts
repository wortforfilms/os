import seedDataset from "../../data/hkd-lipi-script-registry-seed-426.json" with { type: "json" };
import architecture from "../../data/hkd-lipi-registry-architecture.json" with { type: "json" };
import numeralRegistry from "../../data/hkd-lipi-numeral-registry.json" with { type: "json" };
import zeroRegistry from "../../data/hkd-lipi-zero-registry.json" with { type: "json" };
import familyGraph from "../../data/hkd-lipi-script-family-graph.json" with { type: "json" };
import unicodeCrosswalk from "../../data/hkd-lipi-unicode-crosswalk.json" with { type: "json" };
import kbsGraph from "../../data/hkd-lipi-kbs-graph.json" with { type: "json" };
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
    },
    sourceRefs: seedDataset.sourceRefs,
    phase3SourcePolicy: "official_unicode_ucd_only",
    phase4SourcePolicy: "hkd_registry_seed_plus_phase3_ucd_artifacts_only",
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
