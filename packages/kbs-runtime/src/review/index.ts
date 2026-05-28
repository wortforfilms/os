import type { KbsReviewItem, KbsRole } from "../types.ts";

export function enqueueReview(claimId: string, role: KbsRole, note: string): KbsReviewItem {
  return { id: `review-${claimId}-${role.toLowerCase()}`, claimId, role, status: "PENDING", note };
}

export function escalateReview(item: KbsReviewItem, note: string): KbsReviewItem {
  return { ...item, status: "ESCALATED", note };
}
