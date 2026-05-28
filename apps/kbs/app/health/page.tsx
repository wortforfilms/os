import React from "react";
import { kbsClaims, kbsGraphEdges, kbsGraphNodes, kbsHealth, kbsSources } from "../../../../packages/kbs-runtime/src";
import { KbsShell } from "../../components/KbsShell";

export default function HealthPage() {
  const health = {
    ...kbsHealth(kbsClaims, kbsSources),
    graphNodes: kbsGraphNodes.length,
    graphEdges: kbsGraphEdges.length
  };
  return (
    <KbsShell active="KBS Health">
      <pre>{JSON.stringify(health, null, 2)}</pre>
    </KbsShell>
  );
}
