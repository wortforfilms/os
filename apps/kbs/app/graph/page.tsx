import React from "react";
import { graphMetrics, kbsGraphEdges, kbsGraphNodes } from "../../../../packages/kbs-runtime/src";
import { KbsShell } from "../../components/KbsShell";

export default function GraphPage() {
  const metrics = graphMetrics(kbsGraphNodes, kbsGraphEdges);
  return (
    <KbsShell active="Graph">
      <p>Nodes: {metrics.nodes} Relations: {metrics.edges} Node Types: {metrics.nodeTypes}</p>
      {kbsGraphEdges.map((edge) => <article key={edge.id}>{edge.from} {edge.type} {edge.to}</article>)}
    </KbsShell>
  );
}
