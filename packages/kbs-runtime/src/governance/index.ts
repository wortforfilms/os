import type { KbsGovernanceState } from "../types.ts";

export function evaluateKbsGate(state: KbsGovernanceState) {
  const pass = state.productionReady === false && state.finalStatus === "GOVERNED_PRODUCTION_NO_GO" && state.blockers.length > 0;
  return {
    pass,
    productionReady: false,
    finalStatus: "GOVERNED_PRODUCTION_NO_GO" as const,
    phkdVerdict: "BLOCKED" as const,
    blockers: state.blockers
  };
}

export function rejectProductionClaim(input: string) {
  return /production ready|scientifically certified|hardware attested|operator quorum passed|fake citation|fabricated source/i.test(input);
}
