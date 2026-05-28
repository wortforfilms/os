export type KbsClaimStatus = "VERIFIED" | "PARTIAL" | "UNVERIFIED" | "BLOCKED" | "DISPUTED";
export type KbsNodeType = "SOURCE" | "CLAIM" | "DOMAIN" | "CITATION" | "EVIDENCE" | "PERSON" | "EVENT" | "SCRIPT" | "MANUSCRIPT" | "ARTIFACT";
export type KbsEdgeType = "CITES" | "SUPPORTS" | "CONTRADICTS" | "DERIVES_FROM" | "BELONGS_TO" | "TRANSLATES_TO" | "VERIFIED_BY" | "REVIEWED_BY";
export type KbsRole = "SCHOLAR" | "REVIEWER" | "CURATOR" | "ARCHIVIST" | "MODERATOR" | "OPERATOR";

export interface KbsSource {
  id: string;
  title: string;
  type: string;
  author?: string;
  trustLevel: "HIGH" | "MEDIUM" | "LOW" | "BLOCKED";
  status: KbsClaimStatus;
  hash?: string;
}

export interface KbsCitation {
  id: string;
  sourceId: string;
  locator: string;
  quote?: string;
  hash?: string;
}

export interface KbsClaim {
  id: string;
  text: string;
  domain: string;
  status: KbsClaimStatus;
  citations: KbsCitation[];
  evidenceIds: string[];
  confidence: number;
  frozen: boolean;
  blockedReason?: string;
}

export interface KbsGraphNode {
  id: string;
  type: KbsNodeType;
  label: string;
  status?: KbsClaimStatus;
}

export interface KbsGraphEdge {
  id: string;
  from: string;
  to: string;
  type: KbsEdgeType;
  confidence: number;
}

export interface KbsReviewItem {
  id: string;
  claimId: string;
  role: KbsRole;
  status: "PENDING" | "APPROVED" | "REJECTED" | "ESCALATED";
  note: string;
}

export interface KbsGovernanceState {
  productionReady: false;
  phkdVerdict: "BLOCKED";
  finalStatus: "GOVERNED_PRODUCTION_NO_GO";
  blockers: string[];
}
