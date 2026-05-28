import type { KbsClaim, KbsClaimStatus, KbsSource } from "../types.ts";

const blockedPatterns = [/cures all/i, /guaranteed scientific proof/i, /verified without source/i, /production ready/i];

export function classifyClaim(claim: Pick<KbsClaim, "text" | "citations" | "evidenceIds" | "confidence">, sources: KbsSource[]): KbsClaimStatus {
  if (blockedPatterns.some((pattern) => pattern.test(claim.text))) return "BLOCKED";
  if (claim.citations.length === 0 || claim.evidenceIds.length === 0) return "BLOCKED";
  const linkedSources = claim.citations.map((citation) => sources.find((source) => source.id === citation.sourceId));
  if (linkedSources.some((source) => !source || source.trustLevel === "BLOCKED")) return "BLOCKED";
  if (claim.confidence >= 0.85 && linkedSources.every((source) => source?.trustLevel === "HIGH")) return "VERIFIED";
  if (claim.confidence >= 0.5) return "PARTIAL";
  return "UNVERIFIED";
}

export function freezeUnsupportedClaim(claim: KbsClaim, sources: KbsSource[]): KbsClaim {
  const status = classifyClaim(claim, sources);
  if (status === "BLOCKED") {
    return { ...claim, status, frozen: true, blockedReason: claim.blockedReason ?? "Claim lacks sufficient citation lineage or trusted evidence." };
  }
  return { ...claim, status };
}

export function detectContradictions(claims: KbsClaim[]) {
  const blocked = claims.filter((claim) => claim.status === "BLOCKED").map((claim) => claim.id);
  const disputed = claims.filter((claim) => claim.status === "DISPUTED").map((claim) => claim.id);
  return { blocked, disputed, hasContradictions: blocked.length > 0 || disputed.length > 0 };
}
