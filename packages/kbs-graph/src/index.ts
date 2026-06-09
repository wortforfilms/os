export { graphMetrics, traverseFrom, validateGraph } from "../../kbs-runtime/src/graph/index.ts";
export { kbsGraphEdges, kbsGraphNodes } from "../../kbs-runtime/src/data.ts";
export type { KbsEdgeType, KbsGraphEdge, KbsGraphNode, KbsNodeType } from "../../kbs-runtime/src/types.ts";

// Knowledge-graph relation taxonomy (13 types) — see relation-types.ts.
export * from "./relation-types.ts";
export * from "./relation-store.ts";
