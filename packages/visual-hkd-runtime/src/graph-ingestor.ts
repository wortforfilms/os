import type { KnowledgeGraphProjection, VisualHKD } from "./types.ts";

export function ingestVisualHKDToGraph(hkd: VisualHKD): KnowledgeGraphProjection {
  return {
    nodes: hkd.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      kind: node.kind,
      sourceImage: node.sourceImage,
      sourceSectionId: node.sourceSectionId
    })),
    edges: hkd.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      relation: edge.relation,
      confidence: edge.confidence,
      sourceImage: edge.sourceImage,
      sourceSectionId: edge.sourceSectionId
    }))
  };
}
