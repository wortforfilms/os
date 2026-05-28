import type { KbsClaim, KbsGraphEdge, KbsGraphNode, KbsSource } from "../types.ts";
import { stableHash } from "../provenance/index.ts";

export interface KbsEvidenceManifestInput {
  claims: KbsClaim[];
  sources: KbsSource[];
  nodes?: KbsGraphNode[];
  edges?: KbsGraphEdge[];
}

export function exportEvidenceManifest(input: KbsEvidenceManifestInput | KbsClaim[], maybeSources?: KbsSource[]) {
  const claims = Array.isArray(input) ? input : input.claims;
  const sources = Array.isArray(input) ? (maybeSources ?? []) : input.sources;
  const nodes = Array.isArray(input) ? [] : input.nodes ?? [];
  const edges = Array.isArray(input) ? [] : input.edges ?? [];
  const payload = {
    schema: "maataa.kbs.evidence-manifest.v1",
    productionReady: false,
    finalStatus: "GOVERNED_PRODUCTION_NO_GO",
    claimCount: claims.length,
    sourceCount: sources.length,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    blockedClaims: claims.filter((claim) => claim.status === "BLOCKED").map((claim) => claim.id)
  };
  return { ...payload, evidenceHash: stableHash(payload) };
}
