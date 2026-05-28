import React from "react";
import { kbsClaims } from "../../../../packages/kbs-runtime/src";
import { KbsShell } from "../../components/KbsShell";

export default function ClaimsPage() {
  return (
    <KbsShell active="Claims">
      {kbsClaims.map((claim) => (
        <article key={claim.id}>
          <a href={`/kbs/claims/${claim.id}`}>{claim.text}</a>
          <p>{claim.status}{claim.blockedReason ? ` - ${claim.blockedReason}` : ""}</p>
        </article>
      ))}
    </KbsShell>
  );
}
