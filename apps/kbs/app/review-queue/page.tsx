import React from "react";
import { enqueueReview, kbsClaims } from "../../../../packages/kbs-runtime/src";
import { KbsShell } from "../../components/KbsShell";

export default function ReviewQueuePage() {
  const queue = kbsClaims.map((claim) => enqueueReview(claim.id, "REVIEWER", `Review requested for ${claim.status} claim.`));
  return (
    <KbsShell active="Review Queue">
      {queue.map((item) => <article key={item.id}>{item.claimId} - {item.status} - {item.note}</article>)}
    </KbsShell>
  );
}
