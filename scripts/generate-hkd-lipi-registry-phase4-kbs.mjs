import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const INPUTS = {
  seed: "data/hkd-lipi-script-registry-seed-426.json",
  numeral: "data/hkd-lipi-numeral-registry.json",
  zero: "data/hkd-lipi-zero-registry.json",
  family: "data/hkd-lipi-script-family-graph.json",
  crosswalk: "data/hkd-lipi-unicode-crosswalk.json",
};

const OUT = {
  nodes: "data/hkd-lipi-kbs-nodes.json",
  edges: "data/hkd-lipi-kbs-edges.json",
  graph: "data/hkd-lipi-kbs-graph.json",
  evidence: "release/evidence/hkd-lipi-registry-phase4-kbs.json",
};

const GENERATED_AT = new Date().toISOString();
const REVIEW_STATE = "CONTROLLED_NO_GO";
const GOVERNED_PRODUCTION_GO = false;
const PRODUCTION_READY = false;
const RUNTIME_ENABLED = 0;
const PHKD_VERDICT = "CONTROLLED_NO_GO";
const SOURCE_POLICY = "hkd_registry_seed_plus_phase3_ucd_artifacts_only";
const GENERATED_BY = "scripts/generate-hkd-lipi-registry-phase4-kbs.mjs";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
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

function makeNode(type, id, label, fields, sourceRefs, scope) {
  return {
    id,
    type,
    label,
    fields,
    sourceRefs: unique(sourceRefs),
    provenance: provenance(scope, sourceRefs),
  };
}

function makeEdge(type, from, to, fields, sourceRefs, scope) {
  return {
    id: `kbs:edge:${slug(type)}:${slug(from)}:${slug(to)}`,
    type,
    from,
    to,
    fields,
    sourceRefs: unique(sourceRefs),
    provenance: provenance(scope, sourceRefs),
  };
}

function countBy(items, selectKey) {
  return items.reduce((acc, item) => {
    const key = selectKey(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function firstBy(items, selectKey) {
  const map = new Map();
  for (const item of items) {
    const key = selectKey(item);
    if (!map.has(key)) map.set(key, item);
  }
  return map;
}

function rangeNodeId(range) {
  return `kbs:unicode-range:${slug(range)}`;
}

function blockNodeId(blockName) {
  return `kbs:unicode-block:${slug(blockName)}`;
}

function unicodeScriptNodeId(scriptValue) {
  return `kbs:unicode-script:${slug(scriptValue)}`;
}

function decimalDigitNodeId(scriptValue) {
  return `kbs:decimal-digits:${slug(scriptValue)}`;
}

function zeroGlyphNodeId(scriptValue) {
  return `kbs:zero-glyph:${slug(scriptValue)}`;
}

function evidenceSourceNodeId(sourceId) {
  return `kbs:evidence-source:${slug(sourceId)}`;
}

function registryClassNodeId(registryClass) {
  return `kbs:registry-class:${slug(registryClass)}`;
}

function unicodeStatusNodeId(unicodeStatus) {
  return `kbs:unicode-status:${slug(unicodeStatus)}`;
}

function phkdStatusNodeId() {
  return "kbs:phkd-status:controlled-no-go";
}

function main() {
  const seed = readJson(INPUTS.seed);
  const numeral = readJson(INPUTS.numeral);
  const zero = readJson(INPUTS.zero);
  const family = readJson(INPUTS.family);
  const crosswalk = readJson(INPUTS.crosswalk);

  const records = seed.records;
  const crosswalkByScript = new Map(crosswalk.records.map((entry) => [entry.unicodeScriptValue, entry]));
  const numeralByScript = new Map(numeral.records.map((entry) => [entry.scriptValue, entry]));
  const zeroByScript = new Map(zero.records.map((entry) => [entry.scriptValue, entry]));
  const blockByName = firstBy(
    crosswalk.records.flatMap((entry) => entry.unicodeBlocks),
    (block) => block.blockName,
  );
  const rangeByRange = firstBy(
    crosswalk.records.flatMap((entry) =>
      entry.unicodeRanges.map((range) => ({
        range,
        sourceRefs: entry.sourceRefs,
      })),
    ),
    (entry) => entry.range,
  );

  const sourceIds = unique([
    ...records.flatMap((record) => record.source_refs),
    ...crosswalk.records.flatMap((record) => record.sourceRefs),
    ...numeral.records.flatMap((record) => record.sourceRefs),
    ...zero.records.flatMap((record) => record.sourceRefs),
  ]);

  const nodes = [];
  const edges = [];

  for (const record of records) {
    nodes.push(
      makeNode(
        "Script",
        record.kbs_node_id,
        record.display_name,
        {
          registry_id: record.id,
          registry_index: record.registry_index,
          display_name: record.display_name,
          registry_class: record.registry_class,
          unicode_script_value: record.unicode_script_value,
          unicode_script_alias: record.unicode_script_alias,
          iso15924: record.iso15924,
          unicode_status: record.unicode_status,
          evidence_status: record.evidence_status,
          phkd_status: REVIEW_STATE,
          runtime_enabled: record.hkd_runtime_enabled,
          production_ready: false,
        },
        record.source_refs,
        "script_registry_record_node",
      ),
    );
  }

  for (const record of crosswalk.records) {
    nodes.push(
      makeNode(
        "UnicodeScript",
        unicodeScriptNodeId(record.unicodeScriptValue),
        record.unicodeScriptValue.replace(/_/g, " "),
        {
          unicode_script_value: record.unicodeScriptValue,
          unicode_script_alias: record.unicodeScriptAlias,
          iso15924: record.iso15924,
          script_property_kind: record.scriptPropertyKind,
        },
        record.sourceRefs,
        "unicode_script_value_node",
      ),
    );
  }

  for (const block of Array.from(blockByName.values()).sort((a, b) => a.blockName.localeCompare(b.blockName))) {
    nodes.push(
      makeNode(
        "UnicodeBlock",
        blockNodeId(block.blockName),
        block.blockName,
        {
          block_name: block.blockName,
          range: block.range,
          start: block.start,
          end: block.end,
        },
        block.provenance?.sourceIds ?? ["unicode-ucd-17-blocks"],
        "unicode_block_node",
      ),
    );
  }

  for (const rangeEntry of Array.from(rangeByRange.values()).sort((a, b) => a.range.localeCompare(b.range))) {
    nodes.push(
      makeNode(
        "UnicodeRange",
        rangeNodeId(rangeEntry.range),
        rangeEntry.range,
        {
          range: rangeEntry.range,
        },
        rangeEntry.sourceRefs,
        "unicode_range_node",
      ),
    );
  }

  for (const record of numeral.records) {
    nodes.push(
      makeNode(
        "DecimalDigitInventory",
        decimalDigitNodeId(record.scriptValue),
        `${record.scriptValue.replace(/_/g, " ")} digits 0-9`,
        {
          script_value: record.scriptValue,
          digit_count: record.digits_0_9.length,
          all_values_present: record.allValuesPresent,
          zero_code_point: record.zeroCodePoint,
          digits_0_9: record.digits_0_9,
        },
        record.sourceRefs,
        "decimal_digit_inventory_node",
      ),
    );
  }

  for (const record of zero.records) {
    nodes.push(
      makeNode(
        "ZeroGlyph",
        zeroGlyphNodeId(record.scriptValue),
        `${record.scriptValue.replace(/_/g, " ")} zero`,
        {
          script_value: record.scriptValue,
          zero_glyph: record.zeroGlyph,
          zero_code_point: record.zeroCodePoint,
        },
        record.sourceRefs,
        "zero_glyph_node",
      ),
    );
  }

  for (const sourceId of sourceIds) {
    nodes.push(
      makeNode(
        "EvidenceSource",
        evidenceSourceNodeId(sourceId),
        sourceId,
        {
          source_id: sourceId,
          trusted_input: sourceId.startsWith("unicode-ucd-17") ? "phase3_ucd_derived_artifact" : "registry_seed_source_ref",
        },
        [sourceId],
        "evidence_source_node",
      ),
    );
  }

  for (const registryClass of unique(records.map((record) => record.registry_class))) {
    nodes.push(
      makeNode(
        "RegistryClass",
        registryClassNodeId(registryClass),
        registryClass,
        {
          registry_class: registryClass,
          record_count: records.filter((record) => record.registry_class === registryClass).length,
        },
        ["hkd-registry-architect-user-prompt"],
        "registry_class_node",
      ),
    );
  }

  for (const unicodeStatus of unique(records.map((record) => record.unicode_status))) {
    nodes.push(
      makeNode(
        "UnicodeStatus",
        unicodeStatusNodeId(unicodeStatus),
        unicodeStatus,
        {
          unicode_status: unicodeStatus,
          record_count: records.filter((record) => record.unicode_status === unicodeStatus).length,
        },
        ["hkd-registry-architect-user-prompt"],
        "unicode_status_node",
      ),
    );
  }

  nodes.push(
    makeNode(
      "PHKDStatus",
      phkdStatusNodeId(),
      PHKD_VERDICT,
      {
        phkd_verdict: PHKD_VERDICT,
        review_state: REVIEW_STATE,
        governed_production_go: GOVERNED_PRODUCTION_GO,
        production_ready: PRODUCTION_READY,
        runtime_enabled: RUNTIME_ENABLED,
        blocked_fields: [
          "runtime_enabled",
          "production_ready",
          "font_support_status",
          "transliteration_systems",
          "genealogical_family_descent",
        ],
      },
      ["hkd-registry-architect-user-prompt"],
      "phkd_status_node",
    ),
  );

  for (const record of records) {
    const scriptNodeId = record.kbs_node_id;
    const crosswalkEntry = crosswalkByScript.get(record.unicode_script_value);
    const numeralEntry = numeralByScript.get(record.unicode_script_value);
    const zeroEntry = zeroByScript.get(record.unicode_script_value);

    if (crosswalkEntry) {
      edges.push(
        makeEdge(
          "SCRIPT_HAS_UNICODE_VALUE",
          scriptNodeId,
          unicodeScriptNodeId(crosswalkEntry.unicodeScriptValue),
          {
            registry_id: record.id,
            unicode_script_value: crosswalkEntry.unicodeScriptValue,
            unicode_script_alias: crosswalkEntry.unicodeScriptAlias,
            iso15924: crosswalkEntry.iso15924,
          },
          crosswalkEntry.sourceRefs,
          "script_has_unicode_value",
        ),
      );

      for (const block of crosswalkEntry.unicodeBlocks) {
        edges.push(
          makeEdge(
            "SCRIPT_IN_UNICODE_BLOCK",
            scriptNodeId,
            blockNodeId(block.blockName),
            {
              registry_id: record.id,
              block_name: block.blockName,
              range: block.range,
            },
            block.provenance?.sourceIds ?? ["unicode-ucd-17-blocks"],
            "script_in_unicode_block",
          ),
        );
      }

      for (const range of crosswalkEntry.unicodeRanges) {
        edges.push(
          makeEdge(
            "SCRIPT_HAS_UNICODE_RANGE",
            scriptNodeId,
            rangeNodeId(range),
            {
              registry_id: record.id,
              unicode_range: range,
            },
            crosswalkEntry.sourceRefs,
            "script_has_unicode_range",
          ),
        );
      }
    }

    if (numeralEntry) {
      edges.push(
        makeEdge(
          "SCRIPT_HAS_DECIMAL_DIGITS",
          scriptNodeId,
          decimalDigitNodeId(numeralEntry.scriptValue),
          {
            registry_id: record.id,
            script_value: numeralEntry.scriptValue,
            digit_count: numeralEntry.digits_0_9.length,
            all_values_present: numeralEntry.allValuesPresent,
          },
          numeralEntry.sourceRefs,
          "script_has_decimal_digits",
        ),
      );
    }

    if (zeroEntry) {
      edges.push(
        makeEdge(
          "SCRIPT_HAS_ZERO_GLYPH",
          scriptNodeId,
          zeroGlyphNodeId(zeroEntry.scriptValue),
          {
            registry_id: record.id,
            script_value: zeroEntry.scriptValue,
            zero_glyph: zeroEntry.zeroGlyph,
            zero_code_point: zeroEntry.zeroCodePoint,
          },
          zeroEntry.sourceRefs,
          "script_has_zero_glyph",
        ),
      );
    }

    for (const sourceRef of record.source_refs) {
      edges.push(
        makeEdge(
          "SCRIPT_BACKED_BY_EVIDENCE",
          scriptNodeId,
          evidenceSourceNodeId(sourceRef),
          {
            registry_id: record.id,
            evidence_status: record.evidence_status,
            source_ref: sourceRef,
          },
          [sourceRef],
          "script_backed_by_evidence",
        ),
      );
    }

    edges.push(
      makeEdge(
        "SCRIPT_HAS_REGISTRY_CLASS",
        scriptNodeId,
        registryClassNodeId(record.registry_class),
        {
          registry_id: record.id,
          registry_class: record.registry_class,
        },
        record.source_refs,
        "script_has_registry_class",
      ),
      makeEdge(
        "SCRIPT_HAS_UNICODE_STATUS",
        scriptNodeId,
        unicodeStatusNodeId(record.unicode_status),
        {
          registry_id: record.id,
          unicode_status: record.unicode_status,
        },
        record.source_refs,
        "script_has_unicode_status",
      ),
      makeEdge(
        "SCRIPT_HAS_PHKD_STATUS",
        scriptNodeId,
        phkdStatusNodeId(),
        {
          registry_id: record.id,
          phkd_verdict: PHKD_VERDICT,
          runtime_enabled: record.hkd_runtime_enabled,
          production_ready: false,
        },
        record.source_refs,
        "script_has_phkd_status",
      ),
    );
  }

  const sortedNodes = nodes.sort((a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
  const sortedEdges = edges.sort((a, b) => a.type.localeCompare(b.type) || a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  const nodeIds = new Set(sortedNodes.map((node) => node.id));
  const decimalScripts = new Set(numeral.records.map((record) => record.scriptValue));

  const summary = {
    totalNodes: sortedNodes.length,
    totalEdges: sortedEdges.length,
    nodeTypes: countBy(sortedNodes, (node) => node.type),
    edgeTypes: countBy(sortedEdges, (edge) => edge.type),
    scriptNodes: sortedNodes.filter((node) => node.type === "Script").length,
    unicodeScriptNodes: sortedNodes.filter((node) => node.type === "UnicodeScript").length,
    decimalDigitInventories: sortedNodes.filter((node) => node.type === "DecimalDigitInventory").length,
    zeroGlyphNodes: sortedNodes.filter((node) => node.type === "ZeroGlyph").length,
    evidenceSourceNodes: sortedNodes.filter((node) => node.type === "EvidenceSource").length,
    runtimeEnabledRows: records.filter((record) => record.hkd_runtime_enabled === true).length,
    productionReady: PRODUCTION_READY,
    phkdVerdict: PHKD_VERDICT,
    blockedFields: [
      {
        field: "genealogical_family_descent",
        status: "BLOCKED",
        reason: "No descent edge is generated because Phase 3 uses official Unicode UCD artifacts only.",
      },
      {
        field: "font_support_status",
        status: "UNKNOWN",
        reason: "Unicode UCD does not define font support.",
      },
      {
        field: "transliteration_systems",
        status: "UNKNOWN",
        reason: "Unicode UCD does not define transliteration mappings.",
      },
      {
        field: "runtime_enabled",
        status: "0",
        reason: "Phase 4 graph is evidence-only and does not enable runtime execution.",
      },
      {
        field: "production_ready",
        status: "false",
        reason: "PHKD verdict remains CONTROLLED_NO_GO until independent review completes.",
      },
    ],
  };

  const checks = {
    scriptNodeCountIs426: summary.scriptNodes === 426,
    everyUnicodeScriptRowHasEvidenceEdge: records
      .filter((record) => record.registry_class === "unicode")
      .every((record) => sortedEdges.some((edge) => edge.type === "SCRIPT_BACKED_BY_EVIDENCE" && edge.from === record.kbs_node_id)),
    everyDecimalDigitGroupHasZeroGlyphEdge: records
      .filter((record) => decimalScripts.has(record.unicode_script_value))
      .every((record) => sortedEdges.some((edge) => edge.type === "SCRIPT_HAS_ZERO_GLYPH" && edge.from === record.kbs_node_id)),
    everyNodeHasProvenance: sortedNodes.every((node) => Boolean(node.provenance?.sourceIds?.length)),
    everyEdgeHasProvenance: sortedEdges.every((edge) => Boolean(edge.provenance?.sourceIds?.length)),
    everyEdgeEndpointExists: sortedEdges.every((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)),
    noRuntimeEnabledRows: records.every((record) => record.hkd_runtime_enabled === false),
    productionReadinessRemainsFalse: PRODUCTION_READY === false && GOVERNED_PRODUCTION_GO === false,
    phase3FamilyGraphKeepsGenealogyBlocked: family.summary.genealogicalFamilyEdges === 0 && family.edges.genealogicalFamilyEdges.length === 0,
    noGenealogicalDescentEdges: sortedEdges.every((edge) => !edge.type.includes("GENEALOGICAL") && !edge.type.includes("DESCENT")),
    noFontSupportInvented: crosswalk.records.every((record) => record.fontSupportMetadata.status === "UNKNOWN"),
    noTransliterationMappingsInvented: crosswalk.records.every((record) => record.transliterationMetadata.status === "UNKNOWN" && record.transliterationMetadata.systems.length === 0),
  };

  const nodesArtifact = baseArtifact("hkd-lipi-kbs-nodes.v1", {
    summary: {
      total: sortedNodes.length,
      byType: summary.nodeTypes,
    },
    nodes: sortedNodes,
  });
  const edgesArtifact = baseArtifact("hkd-lipi-kbs-edges.v1", {
    summary: {
      total: sortedEdges.length,
      byType: summary.edgeTypes,
    },
    edges: sortedEdges,
  });
  const graphArtifact = baseArtifact("hkd-lipi-kbs-graph.v1", {
    summary,
    nodes: sortedNodes,
    edges: sortedEdges,
  });
  const evidenceArtifact = baseArtifact("hkd-lipi-registry-phase4-kbs-evidence.v1", {
    artifacts: OUT,
    counts: summary,
    checks,
    limitations: [
      "No genealogical script-family descent is inferred.",
      "No font support is invented; font fields remain UNKNOWN unless a non-UCD source is admitted in a future phase.",
      "No transliteration mappings are invented; transliteration fields remain UNKNOWN unless a sourced registry is admitted in a future phase.",
      "All script rows remain runtime_enabled=false and productionReady=false.",
    ],
  });

  writeFileSync(OUT.nodes, `${JSON.stringify(nodesArtifact, null, 2)}\n`);
  writeFileSync(OUT.edges, `${JSON.stringify(edgesArtifact, null, 2)}\n`);
  writeFileSync(OUT.graph, `${JSON.stringify(graphArtifact, null, 2)}\n`);
  writeFileSync(OUT.evidence, `${JSON.stringify(evidenceArtifact, null, 2)}\n`);
  console.log(JSON.stringify({ summary, checks }, null, 2));
}

main();
