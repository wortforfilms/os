import type { GovernanceSnapshot, EvidenceItem } from "../types/governance";

export const maataaUiLaunchReadiness: GovernanceSnapshot & {
  publicInterface: {
    aamJantaaInterface: true;
    languages: ["hi", "hr", "pa"];
    honestBadges: true;
    offlineMode: true;
  };
  evidence: EvidenceItem[];
} = {
  package: "@maataa/maataa-ui",
  phase: "MAATAA_UI_RELEASE_CANDIDATE",
  productionReady: false,
  phkdVerdict: "BLOCKED",
  finalStatus: "GOVERNED_PRODUCTION_NO_GO",
  activeBlockers: [
    "hardware_root_attestation_missing",
    "operator_quorum_unverified",
    "signed_release_authority_unverified",
    "rollback_drill_not_verified",
  ],
  publicInterface: {
    aamJantaaInterface: true,
    languages: ["hi", "hr", "pa"],
    honestBadges: true,
    offlineMode: true,
  },
  evidence: [
    {
      id: "hardware-root",
      label: "Hardware-root attestation",
      status: "BLOCKED",
      reason: "No verified hardware-root attestation is captured for production GO.",
    },
    {
      id: "operator-quorum",
      label: "Operator quorum",
      status: "BLOCKED",
      reason: "No enrolled hardware-backed operator quorum is verified.",
    },
    {
      id: "release-authority",
      label: "Signed release authority",
      status: "BLOCKED",
      reason: "No verified hardware-backed signed release manifest is present.",
    },
    {
      id: "rollback-drill",
      label: "Rollback drill",
      status: "VERIFYING",
      reason: "Rollback drill success has not been captured as evidence.",
    },
  ],
};
