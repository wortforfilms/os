import type { KbsClaim, KbsSource } from "../types.ts";

export function kbsHealth(claims: KbsClaim[], sources: KbsSource[]) {
  const blockedClaims = claims.filter((claim) => claim.status === "BLOCKED").length;
  return {
    status: "OPERATIONAL_PREVIEW" as const,
    claims: claims.length,
    sources: sources.length,
    blockedClaims,
    productionReady: false
  };
}
