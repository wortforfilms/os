export interface LipiLineageEdgeRecord {
  id: string;
  parentScriptId: string;
  childScriptId: string;
  relationType: "DERIVED" | "INFLUENCED" | "REGIONAL_BRANCH" | "COMMERCIAL_BRANCH" | "UNKNOWN";
  confidence: number;
  evidenceNote?: string;
}
