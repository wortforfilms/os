export {
  detectContradictions,
  freezeUnsupportedClaim,
  classifyClaim
} from "../../kbs-runtime/src/claims/index.ts";
export { evaluateKbsGate, rejectProductionClaim } from "../../kbs-runtime/src/governance/index.ts";
export { moderateClaim } from "../../kbs-runtime/src/moderation/index.ts";
export { enqueueReview, escalateReview } from "../../kbs-runtime/src/review/index.ts";
export type { KbsClaim, KbsClaimStatus, KbsGovernanceState, KbsReviewItem, KbsRole } from "../../kbs-runtime/src/types.ts";
