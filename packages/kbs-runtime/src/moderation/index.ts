import type { KbsClaim } from "../types.ts";
import { rejectProductionClaim } from "../governance/index.ts";

export function moderateClaim(claim: KbsClaim) {
  if (rejectProductionClaim(claim.text) || claim.status === "BLOCKED") {
    return {
      allowed: false,
      status: "BLOCKED" as const,
      reason: claim.blockedReason ?? "Unsupported or over-claimed knowledge assertion."
    };
  }
  return { allowed: true, status: claim.status, reason: "Claim may proceed to review." };
}
