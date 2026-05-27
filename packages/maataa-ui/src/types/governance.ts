export const HONEST_STATUS_BADGES = [
  "READY",
  "PREVIEW",
  "BLOCKED",
  "OFFLINE",
  "VERIFYING",
  "DEGRADED",
] as const;

export type HonestStatusBadgeValue = (typeof HONEST_STATUS_BADGES)[number];

export type GovernedFinalStatus = "GOVERNED_PRODUCTION_NO_GO";

export interface GovernanceSnapshot {
  package: "@maataa/maataa-ui";
  phase: "MAATAA_UI_RELEASE_CANDIDATE";
  productionReady: false;
  phkdVerdict: "BLOCKED";
  finalStatus: GovernedFinalStatus;
  activeBlockers: string[];
}

export interface EvidenceItem {
  id: string;
  label: string;
  status: HonestStatusBadgeValue;
  reason: string;
}
