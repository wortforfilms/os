import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const INPUTS = {
  seed: "data/hkd-lipi-script-registry-seed-426.json",
  nodes: "data/hkd-lipi-kbs-nodes.json",
  edges: "data/hkd-lipi-kbs-edges.json",
  graph: "data/hkd-lipi-kbs-graph.json",
  phase4Evidence: "release/evidence/hkd-lipi-registry-phase4-kbs.json",
};

const OUT = {
  json: "release/exports/hkd-lipi-registry-export.json",
  csv: "release/exports/hkd-lipi-registry-export.csv",
  sql: "release/exports/hkd-lipi-registry-export.sql",
  audit: "release/evidence/hkd-lipi-registry-audit-report.json",
  provenance: "release/evidence/hkd-lipi-registry-provenance-report.json",
};

const GENERATED_AT = "DETERMINISTIC_FROM_INPUT_HASHES";
const REVIEW_STATE = "CONTROLLED_NO_GO";
const GOVERNED_PRODUCTION_GO = false;
const PRODUCTION_READY = false;
const RUNTIME_ENABLED = 0;
const PHKD_VERDICT = "CONTROLLED_NO_GO";
const SOURCE_POLICY = "registry_seed_plus_phase4_kbs_graph_only";
const GENERATED_BY = "scripts/generate-hkd-lipi-registry-audit-exports.mjs";

function read(path) {
  return readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

function sha256Text(text) {
  return createHash("sha256").update(text).digest("hex");
}

function sha256(path) {
  return sha256Text(read(path));
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
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

function jsonString(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join("|") : value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function sqlString(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlBool(value) {
  return value ? "1" : "0";
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
  const nodesArtifact = readJson(INPUTS.nodes);
  const edgesArtifact = readJson(INPUTS.edges);
  const graph = readJson(INPUTS.graph);
  const phase4Evidence = readJson(INPUTS.phase4Evidence);

  const records = seed.records;
  const nodes = nodesArtifact.nodes;
  const edges = edgesArtifact.edges;
  const evidenceSourceNodes = nodes.filter((node) => node.type === "EvidenceSource");
  const evidenceSourceIds = new Set(evidenceSourceNodes.map((node) => node.fields.source_id));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edgeEndpointProblems = edges.filter((edge) => !nodeIds.has(edge.from) || !nodeIds.has(edge.to));
  const nodeEvidenceRefs = unique(nodes.flatMap((node) => node.provenance?.sourceIds ?? []));
  const edgeEvidenceRefs = unique(edges.flatMap((edge) => edge.provenance?.sourceIds ?? []));
  const allEvidenceRefs = unique([...nodeEvidenceRefs, ...edgeEvidenceRefs]);
  const orphanEvidenceReferences = allEvidenceRefs.filter((sourceId) => !evidenceSourceIds.has(sourceId));
  const nodesMissingProvenance = nodes.filter((node) => !(node.provenance?.sourceIds?.length > 0)).map((node) => node.id);
  const edgesMissingProvenance = edges.filter((edge) => !(edge.provenance?.sourceIds?.length > 0)).map((edge) => edge.id);
  const nodesUnreachableFromProvenance = nodes
    .filter((node) => !(node.provenance?.sourceIds ?? []).some((sourceId) => evidenceSourceIds.has(sourceId)))
    .map((node) => node.id);

  const edgeCountByScript = countBy(
    edges.filter((edge) => edge.from.startsWith("kbs:script:")),
    (edge) => edge.from,
  );

  const scriptRows = records.map((record) => ({
    id: record.id,
    registry_index: record.registry_index,
    display_name: record.display_name,
    registry_class: record.registry_class,
    unicode_status: record.unicode_status,
    evidence_status: record.evidence_status,
    unicode_script_value: record.unicode_script_value,
    unicode_script_alias: record.unicode_script_alias,
    iso15924: record.iso15924,
    unicode_blocks: record.unicode_blocks,
    unicode_ranges: record.unicode_ranges,
    runtime_enabled: record.hkd_runtime_enabled,
    productionReady: false,
    phkdVerdict: PHKD_VERDICT,
    kbs_node_id: record.kbs_node_id,
    kbs_edge_count: edgeCountByScript[record.kbs_node_id] ?? 0,
    source_refs: record.source_refs,
    provenance: record.provenance,
  }));

  const registryDiff = {
    baseRecordCount: records.length,
    exportRecordCount: scriptRows.length,
    addedRows: [],
    removedRows: [],
    changedCriticalFields: scriptRows
      .filter((row) => row.runtime_enabled !== false || row.productionReady !== false || row.phkdVerdict !== PHKD_VERDICT)
      .map((row) => row.id),
    criticalFieldPolicy: ["id", "kbs_node_id", "runtime_enabled", "productionReady", "phkdVerdict"],
  };

  const exportJson = baseArtifact("hkd-lipi-registry-export.v1", {
    exportFormat: "json",
    counts: {
      registryRows: scriptRows.length,
      kbsNodes: nodes.length,
      kbsEdges: edges.length,
      evidenceSources: evidenceSourceNodes.length,
    },
    checks: {
      noRuntimeEnabledTrue: records.every((record) => record.hkd_runtime_enabled === false),
      noProductionReadyTrue: scriptRows.every((row) => row.productionReady === false),
      everyNodeHasProvenance: nodesMissingProvenance.length === 0,
      everyEdgeHasProvenance: edgesMissingProvenance.length === 0,
      noOrphanEvidenceReferences: orphanEvidenceReferences.length === 0,
      everyNodeReachableFromProvenance: nodesUnreachableFromProvenance.length === 0,
      everyEdgeEndpointExists: edgeEndpointProblems.length === 0,
    },
    registryDiff,
    scripts: scriptRows,
    kbs: {
      nodes,
      edges,
    },
    provenance: provenance("registry_export", allEvidenceRefs),
  });
  const exportJsonText = jsonString(exportJson);

  const csvColumns = [
    "id",
    "registry_index",
    "display_name",
    "registry_class",
    "unicode_status",
    "evidence_status",
    "unicode_script_value",
    "unicode_script_alias",
    "iso15924",
    "unicode_blocks",
    "unicode_ranges",
    "runtime_enabled",
    "productionReady",
    "phkdVerdict",
    "kbs_node_id",
    "kbs_edge_count",
    "source_refs",
  ];
  const csvText = [
    csvColumns.join(","),
    ...scriptRows.map((row) => csvColumns.map((column) => csvCell(row[column])).join(",")),
    "",
  ].join("\n");

  const sqlHeader = [
    "-- HKD Lipi Registry deterministic export",
    "-- PRODUCTION_READY=false",
    "-- RUNTIME_ENABLED=0",
    "-- PHKD_VERDICT=CONTROLLED_NO_GO",
    "BEGIN;",
    "DROP TABLE IF EXISTS hkd_lipi_registry_export;",
    "DROP TABLE IF EXISTS hkd_lipi_kbs_node_export;",
    "DROP TABLE IF EXISTS hkd_lipi_kbs_edge_export;",
    "CREATE TABLE hkd_lipi_registry_export (id TEXT PRIMARY KEY, registry_index INTEGER NOT NULL, display_name TEXT NOT NULL, registry_class TEXT NOT NULL, unicode_status TEXT NOT NULL, evidence_status TEXT NOT NULL, unicode_script_value TEXT NOT NULL, unicode_script_alias TEXT NOT NULL, iso15924 TEXT NOT NULL, runtime_enabled INTEGER NOT NULL, production_ready INTEGER NOT NULL, phkd_verdict TEXT NOT NULL, kbs_node_id TEXT NOT NULL, source_refs_json TEXT NOT NULL);",
    "CREATE TABLE hkd_lipi_kbs_node_export (id TEXT PRIMARY KEY, type TEXT NOT NULL, label TEXT NOT NULL, source_refs_json TEXT NOT NULL, provenance_json TEXT NOT NULL);",
    "CREATE TABLE hkd_lipi_kbs_edge_export (id TEXT PRIMARY KEY, type TEXT NOT NULL, source_id TEXT NOT NULL, target_id TEXT NOT NULL, source_refs_json TEXT NOT NULL, provenance_json TEXT NOT NULL);",
  ];
  const sqlRows = [
    ...scriptRows.map(
      (row) =>
        `INSERT INTO hkd_lipi_registry_export VALUES (${[
          sqlString(row.id),
          row.registry_index,
          sqlString(row.display_name),
          sqlString(row.registry_class),
          sqlString(row.unicode_status),
          sqlString(row.evidence_status),
          sqlString(row.unicode_script_value),
          sqlString(row.unicode_script_alias),
          sqlString(row.iso15924),
          sqlBool(row.runtime_enabled),
          sqlBool(row.productionReady),
          sqlString(row.phkdVerdict),
          sqlString(row.kbs_node_id),
          sqlString(JSON.stringify(row.source_refs)),
        ].join(", ")});`,
    ),
    ...nodes.map(
      (node) =>
        `INSERT INTO hkd_lipi_kbs_node_export VALUES (${[
          sqlString(node.id),
          sqlString(node.type),
          sqlString(node.label),
          sqlString(JSON.stringify(node.sourceRefs)),
          sqlString(JSON.stringify(node.provenance)),
        ].join(", ")});`,
    ),
    ...edges.map(
      (edge) =>
        `INSERT INTO hkd_lipi_kbs_edge_export VALUES (${[
          sqlString(edge.id),
          sqlString(edge.type),
          sqlString(edge.from),
          sqlString(edge.to),
          sqlString(JSON.stringify(edge.sourceRefs)),
          sqlString(JSON.stringify(edge.provenance)),
        ].join(", ")});`,
    ),
    "COMMIT;",
    "",
  ];
  const sqlText = [...sqlHeader, ...sqlRows].join("\n");

  const outputPreview = [
    { id: "json", path: OUT.json, format: "json", bytes: Buffer.byteLength(exportJsonText), sha256: sha256Text(exportJsonText), rows: scriptRows.length },
    { id: "csv", path: OUT.csv, format: "csv", bytes: Buffer.byteLength(csvText), sha256: sha256Text(csvText), rows: scriptRows.length },
    { id: "sql", path: OUT.sql, format: "sql", bytes: Buffer.byteLength(sqlText), sha256: sha256Text(sqlText), rows: scriptRows.length + nodes.length + edges.length },
  ];

  const provenanceReport = baseArtifact("hkd-lipi-registry-provenance-report.v1", {
    counts: {
      evidenceSources: evidenceSourceNodes.length,
      nodeEvidenceRefs: nodeEvidenceRefs.length,
      edgeEvidenceRefs: edgeEvidenceRefs.length,
      allEvidenceRefs: allEvidenceRefs.length,
      nodesMissingProvenance: nodesMissingProvenance.length,
      edgesMissingProvenance: edgesMissingProvenance.length,
      orphanEvidenceReferences: orphanEvidenceReferences.length,
      nodesUnreachableFromProvenance: nodesUnreachableFromProvenance.length,
    },
    evidenceSources: evidenceSourceNodes.map((sourceNode) => {
      const sourceId = sourceNode.fields.source_id;
      const referencingNodes = nodes.filter((node) => (node.provenance?.sourceIds ?? []).includes(sourceId));
      const referencingEdges = edges.filter((edge) => (edge.provenance?.sourceIds ?? []).includes(sourceId));
      return {
        sourceId,
        nodeId: sourceNode.id,
        nodeReferences: referencingNodes.length,
        edgeReferences: referencingEdges.length,
        sampleNodeIds: referencingNodes.slice(0, 12).map((node) => node.id),
        sampleEdgeIds: referencingEdges.slice(0, 12).map((edge) => edge.id),
        provenance: provenance("evidence_source_reference_report", [sourceId]),
      };
    }),
    orphanEvidenceReferences,
    nodesMissingProvenance,
    edgesMissingProvenance,
    nodesUnreachableFromProvenance,
    provenance: provenance("provenance_report", allEvidenceRefs),
  });
  const provenanceText = jsonString(provenanceReport);

  const auditReport = baseArtifact("hkd-lipi-registry-audit-report.v1", {
    artifactPaths: OUT,
    outputHashes: [
      ...outputPreview,
      { id: "provenance", path: OUT.provenance, format: "json", bytes: Buffer.byteLength(provenanceText), sha256: sha256Text(provenanceText), rows: provenanceReport.evidenceSources.length },
    ],
    inputCounts: {
      seedRecords: records.length,
      graphNodes: nodes.length,
      graphEdges: edges.length,
      phase4Checks: phase4Evidence.checks,
    },
    registryDiff,
    checks: {
      everyNodeReachableFromProvenance: nodesUnreachableFromProvenance.length === 0,
      noOrphanEvidenceReferences: orphanEvidenceReferences.length === 0,
      noRuntimeEnabledTrue: records.every((record) => record.hkd_runtime_enabled === false),
      noProductionReadyTrue: scriptRows.every((row) => row.productionReady === false) && graph.productionReady === false && phase4Evidence.productionReady === false,
      exportReproducibilityInputs: Object.entries(INPUTS).map(([id, path]) => ({ id, path, sha256: sha256(path) })),
      exportContentHashes: outputPreview.map(({ id, path, sha256 }) => ({ id, path, sha256 })),
      everyEdgeEndpointExists: edgeEndpointProblems.length === 0,
      everyNodeHasProvenance: nodesMissingProvenance.length === 0,
      everyEdgeHasProvenance: edgesMissingProvenance.length === 0,
    },
    failures: {
      edgeEndpointProblems: edgeEndpointProblems.map((edge) => edge.id),
      orphanEvidenceReferences,
      nodesMissingProvenance,
      edgesMissingProvenance,
      nodesUnreachableFromProvenance,
      changedCriticalFields: registryDiff.changedCriticalFields,
    },
    provenance: provenance("audit_report", allEvidenceRefs),
  });
  const auditText = jsonString(auditReport);

  const outputTexts = {
    [OUT.json]: exportJsonText,
    [OUT.csv]: csvText,
    [OUT.sql]: sqlText,
    [OUT.provenance]: provenanceText,
    [OUT.audit]: auditText,
  };

  if (process.argv.includes("--check")) {
    const mismatches = Object.entries(outputTexts)
      .filter(([path, text]) => read(path) !== text)
      .map(([path]) => path);
    console.log(JSON.stringify({ reproducible: mismatches.length === 0, mismatches }, null, 2));
    if (mismatches.length > 0) process.exit(1);
    return;
  }

  for (const [path, text] of Object.entries(outputTexts)) {
    writeFileSync(path, text);
  }

  console.log(
    JSON.stringify(
      {
        outputs: OUT,
        counts: auditReport.inputCounts,
        checks: auditReport.checks,
        failures: auditReport.failures,
      },
      null,
      2,
    ),
  );
}

main();
