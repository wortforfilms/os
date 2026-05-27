import type { LipiLineageEdgeRecord } from "../types/lineage";

export const scriptLineageGraph: readonly LipiLineageEdgeRecord[] = Object.freeze([
  { id: "brahmi-to-siddham", parentScriptId: "brahmi", childScriptId: "siddham", relationType: "DERIVED", confidence: 0.82, evidenceNote: "Seeded from accepted family grouping; local citation bundle pending." },
  { id: "brahmi-to-sharada", parentScriptId: "brahmi", childScriptId: "sharada", relationType: "REGIONAL_BRANCH", confidence: 0.74, evidenceNote: "Requires local manuscript evidence before certification." },
  { id: "sharada-to-landa", parentScriptId: "sharada", childScriptId: "landa", relationType: "COMMERCIAL_BRANCH", confidence: 0.58, evidenceNote: "Governed as a hypothesis until evidence bundle is attached." },
]);
