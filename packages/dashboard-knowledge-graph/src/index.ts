import {
  graphMetrics,
  kbsGraphEdges,
  kbsGraphNodes,
  traverseFrom,
  validateGraph,
  type KbsGraphEdge,
  type KbsGraphNode,
} from "../../kbs-graph/src/index.ts";

export type KnowledgeGraphDashboardStatus = "PREVIEW_VERIFIED" | "BLOCKED";

export type KnowledgeGraphDashboardRow = {
  id: string;
  label: string;
  type: string;
  status: string;
  degree: number;
  evidencePath: string;
};

export type KnowledgeGraphDashboardModel = {
  dashboard: "knowledge-graph-dashboard";
  status: KnowledgeGraphDashboardStatus;
  route: "/knowledge-graph-dashboard";
  title: "Knowledge Graph Dashboard";
  graph: ReturnType<typeof validateGraph>;
  metrics: ReturnType<typeof graphMetrics>;
  focusNodeId: string | null;
  neighborhood: string[];
  rows: KnowledgeGraphDashboardRow[];
  edgeRows: Array<KbsGraphEdge & { evidencePath: string }>;
  evidenceLinks: string[];
  blockers: string[];
  productionReady: false;
  phkdVerdict: "BLOCKED";
};

export type KnowledgeGraphDashboardInput = {
  nodes?: KbsGraphNode[];
  edges?: KbsGraphEdge[];
  focusNodeId?: string;
};

const DASHBOARD_ROUTE = "/knowledge-graph-dashboard";
const GRAPH_DATA_EVIDENCE = "packages/kbs-runtime/src/data.ts";
const GRAPH_RUNTIME_EVIDENCE = "packages/kbs-runtime/src/graph/index.ts";

export function buildKnowledgeGraphDashboard(input: KnowledgeGraphDashboardInput = {}): KnowledgeGraphDashboardModel {
  const nodes = input.nodes ?? kbsGraphNodes;
  const edges = input.edges ?? kbsGraphEdges;
  const graph = validateGraph(nodes, edges);
  const metrics = graphMetrics(nodes, edges);
  const focusNodeId = input.focusNodeId ?? nodes.find((node) => node.type === "CLAIM")?.id ?? null;
  const focusExists = focusNodeId ? nodes.some((node) => node.id === focusNodeId) : false;
  const neighborhood = graph.valid && focusNodeId && focusExists ? traverseFrom(focusNodeId, edges) : [];
  const status: KnowledgeGraphDashboardStatus = graph.valid && nodes.length > 0 && edges.length > 0 ? "PREVIEW_VERIFIED" : "BLOCKED";
  const blockers = [
    "local preview renderer only; no live deployment is claimed",
    "graph rows come from the current in-repo KBS seed graph, not external production traffic",
    "global PHKD gates remain blocked; productionReady=false",
  ];

  if (!graph.valid) {
    blockers.push(`graph validation failed; missingNodeIds=${graph.missingNodeIds.join(",") || "none"}`);
  }
  if (focusNodeId && !focusExists) {
    blockers.push(`focus node ${focusNodeId} is not present in the graph`);
  }

  return {
    dashboard: "knowledge-graph-dashboard",
    status,
    route: DASHBOARD_ROUTE,
    title: "Knowledge Graph Dashboard",
    graph,
    metrics,
    focusNodeId,
    neighborhood,
    rows: nodes.map((node) => ({
      id: node.id,
      label: node.label,
      type: node.type,
      status: node.status ?? "UNKNOWN",
      degree: edges.filter((edge) => edge.from === node.id || edge.to === node.id).length,
      evidencePath: GRAPH_DATA_EVIDENCE,
    })),
    edgeRows: edges.map((edge) => ({ ...edge, evidencePath: GRAPH_DATA_EVIDENCE })),
    evidenceLinks: [GRAPH_DATA_EVIDENCE, GRAPH_RUNTIME_EVIDENCE, "packages/kbs-graph/src/index.ts"],
    blockers,
    productionReady: false,
    phkdVerdict: "BLOCKED",
  };
}

export function renderKnowledgeGraphDashboardHtml(model = buildKnowledgeGraphDashboard()): string {
  const nodeRows = model.rows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.id)}</td><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.status)}</td><td>${row.degree}</td></tr>`,
    )
    .join("");
  const blockers = model.blockers.map((blocker) => `<li>${escapeHtml(blocker)}</li>`).join("");

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    `<title>${model.title}</title>`,
    "</head>",
    "<body>",
    `<main data-dashboard="${model.dashboard}" data-status="${model.status}">`,
    `<h1>${model.title}</h1>`,
    `<p>FINAL_STATUS=${model.phkdVerdict}; PRODUCTION_READY=${String(model.productionReady).toUpperCase()}</p>`,
    `<section><h2>Graph Metrics</h2><p>nodes=${model.metrics.nodes}; edges=${model.metrics.edges}; valid=${model.graph.valid}</p></section>`,
    `<section><h2>Local Graph Rows</h2><table><thead><tr><th>id</th><th>label</th><th>type</th><th>status</th><th>degree</th></tr></thead><tbody>${nodeRows}</tbody></table></section>`,
    `<section><h2>Blockers</h2><ul>${blockers}</ul></section>`,
    "</main>",
    "</body>",
    "</html>",
  ].join("");
}

export function knowledgeGraphDashboardHealth() {
  const model = buildKnowledgeGraphDashboard();
  return {
    dashboard: model.dashboard,
    status: model.status,
    route: model.route,
    nodes: model.metrics.nodes,
    edges: model.metrics.edges,
    graphValid: model.graph.valid,
    productionReady: false as const,
    phkdVerdict: "BLOCKED" as const,
    blockers: model.blockers,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
