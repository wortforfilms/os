export type LipiPhkdVerdict = "PASS" | "BLOCKED";
export type LipiFinalStatus = "GOVERNED_PRODUCTION_NO_GO" | "GOVERNED_RELEASE_CANDIDATE";

export interface LipiGovernanceEvidence {
  module: "lipi-runtime";
  phase: "PHASE_0_AMIRPUR_TEST_CLUSTER";
  scriptRegistry: {
    expected: number;
    ingested: number;
    status: "PASS" | "BLOCKED";
  };
  productionReady: false;
  phkdVerdict: LipiPhkdVerdict;
  finalStatus: LipiFinalStatus;
  activeBlockers: readonly string[];
}
