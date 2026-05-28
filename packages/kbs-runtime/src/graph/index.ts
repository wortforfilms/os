import type { KbsEdgeType, KbsGraphEdge, KbsGraphNode } from "../types.ts";

export function validateGraph(nodes: KbsGraphNode[], edges: KbsGraphEdge[]) {
  const ids = new Set(nodes.map((node) => node.id));
  const danglingEdges = edges.filter((edge) => !ids.has(edge.from) || !ids.has(edge.to));
  const missingNodeIds = [...new Set(danglingEdges.flatMap((edge) => [edge.from, edge.to].filter((id) => !ids.has(id))))];
  return {
    valid: danglingEdges.length === 0,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    missingNodeIds,
    danglingEdges
  };
}

export function traverseFrom(nodeId: string, edges: KbsGraphEdge[]) {
  const visited = new Set<string>([nodeId]);
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const edge of edges.filter((candidate) => candidate.from === current || candidate.to === current)) {
      const next = edge.from === current ? edge.to : edge.from;
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return [...visited];
}

export function graphMetrics(nodes: KbsGraphNode[], edges: KbsGraphEdge[]) {
  const byType = new Map<KbsEdgeType, number>();
  for (const edge of edges) byType.set(edge.type, (byType.get(edge.type) ?? 0) + 1);
  const nodeTypes = new Set(nodes.map((node) => node.type)).size;
  return { nodes: nodes.length, edges: edges.length, nodeTypes, edgeTypes: Object.fromEntries(byType) };
}
