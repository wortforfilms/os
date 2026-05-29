import assert from "node:assert/strict";
import { test } from "node:test";
import {
  generateRealityMatrixEntries,
  generateRuntimeSuggestions,
  generateVisualHKD,
  ingestVisualHKDToGraph,
  validateVisualHKDStatus,
  type VisualExtractionInput
} from "../packages/visual-hkd-runtime/src/index.ts";

const sample: VisualExtractionInput = {
  id: "universe-board-001",
  title: "Maataa Universe Board Observation",
  sourceImage: "operator://maataa-universe-board-001.png",
  universe: "maataa-os",
  imageHash: "sha256:operator-supplied",
  panels: [
    { id: "panel-chakra-runtime", title: "Chakra Runtime", type: "runtime", confidence: 0.92 },
    { id: "panel-kbs-dashboard", title: "KBS Dashboard", type: "dashboard", confidence: 0.9 },
    { id: "panel-unknown", confidence: 0.52 }
  ],
  textBlocks: [
    { id: "text-chakra", text: "Chakra Runtime", confidence: 0.94, sourceSectionId: "panel-chakra-runtime" },
    { id: "text-kbs", text: "Knowledge Graph", confidence: 0.91, sourceSectionId: "panel-kbs-dashboard" },
    { id: "text-production", text: "Production Ready", confidence: 0.88, sourceSectionId: "panel-kbs-dashboard" },
    { id: "text-blur", text: "possibly invented", confidence: 0.41, sourceSectionId: "panel-unknown" }
  ],
  relations: [
    {
      fromTextId: "text-chakra",
      toTextId: "text-kbs",
      relation: "FEEDS",
      confidence: 0.82,
      sourceSectionId: "panel-kbs-dashboard"
    }
  ]
};

test("generates Visual HKD without inventing unreadable text", () => {
  const hkd = generateVisualHKD(sample);
  assert.equal(hkd.sections.length, 3);
  assert.equal(hkd.sections.find((section) => section.id === "panel-unknown")?.title, "UNREADABLE");
  assert.ok(hkd.evidence.some((item) => item.id === "evidence-uncertain-text-blur"));
});

test("every extracted item carries source image references", () => {
  const hkd = generateVisualHKD(sample);
  const items = [...hkd.sections, ...hkd.nodes, ...hkd.edges, ...hkd.widgets, ...hkd.claims, ...hkd.evidence];
  assert.ok(items.length > 0);
  for (const item of items) assert.equal(item.sourceImage, sample.sourceImage);
});

test("graph ingestion preserves nodes and confident edges", () => {
  const hkd = generateVisualHKD(sample);
  const graph = ingestVisualHKDToGraph(hkd);
  assert.ok(graph.nodes.some((node) => node.label === "Chakra Runtime"));
  assert.equal(graph.edges[0]?.relation, "FEEDS");
  assert.equal(graph.edges[0]?.confidence, 0.82);
});

test("runtime suggestions default to scaffolded unless package exists", () => {
  const hkd = generateVisualHKD(sample);
  const suggestions = generateRuntimeSuggestions(hkd, ["@maataa/kbs-dashboard"]);
  const chakra = suggestions.find((suggestion) => suggestion.packageName === "@maataa/chakra-runtime");
  assert.equal(chakra?.status, "scaffolded");
  assert.equal(chakra?.apiRoute, "/api/chakra-runtime/*");
  const matrix = generateRealityMatrixEntries(hkd, suggestions);
  assert.ok(matrix.some((entry) => entry.status === "scaffolded"));
});

test("production and certification claims remain unverified with blocked reason", () => {
  const hkd = generateVisualHKD(sample);
  const claim = hkd.claims.find((item) => item.text === "Production Ready");
  assert.equal(claim?.status, "UNVERIFIED");
  assert.match(claim?.blockedReason ?? "", /cannot verify/);
});

test("validator remains governed no-go and reports low confidence warnings", () => {
  const hkd = generateVisualHKD(sample);
  const result = validateVisualHKDStatus(hkd);
  assert.equal(result.pass, true);
  assert.equal(result.productionReady, false);
  assert.equal(result.finalStatus, "GOVERNED_PRODUCTION_NO_GO");
  assert.ok(result.warnings.some((warning) => warning.includes("low confidence")));
});
