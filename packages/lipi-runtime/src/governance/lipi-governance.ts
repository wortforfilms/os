import type { LipiGovernanceEvidence } from "../types/governance";
import { LIPI_426_EXPECTED_COUNT, lipi426Master } from "../data/lipi-426-master";
import { lipiBlockedReasons } from "./blocked-reasons";

export const lipiGovernance: LipiGovernanceEvidence = Object.freeze({
  module: "lipi-runtime",
  phase: "PHASE_0_AMIRPUR_TEST_CLUSTER",
  scriptRegistry: {
    expected: LIPI_426_EXPECTED_COUNT,
    ingested: lipi426Master.length,
    status: lipi426Master.length === LIPI_426_EXPECTED_COUNT ? "PASS" as const : "BLOCKED" as const,
  },
  productionReady: false,
  phkdVerdict: "BLOCKED",
  finalStatus: "GOVERNED_PRODUCTION_NO_GO",
  activeBlockers: lipiBlockedReasons,
});
