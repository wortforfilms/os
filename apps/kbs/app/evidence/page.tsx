import React from "react";
import { exportEvidenceManifest, kbsClaims, kbsGraphEdges, kbsGraphNodes, kbsSources } from "../../../../packages/kbs-runtime/src";
import { KbsShell } from "../../components/KbsShell";

export default function EvidencePage() {
  const manifest = exportEvidenceManifest({ claims: kbsClaims, sources: kbsSources, nodes: kbsGraphNodes, edges: kbsGraphEdges });
  return (
    <KbsShell active="Evidence">
      <pre>{JSON.stringify(manifest, null, 2)}</pre>
    </KbsShell>
  );
}
