import React from "react";
import { kbsClaims } from "../../../../../packages/kbs-runtime/src";
import { KbsShell } from "../../../components/KbsShell";

export default function ClaimDetailPage({ params }: { params: { id: string } }) {
  const claim = kbsClaims.find((item) => item.id === params.id) ?? kbsClaims[0];
  return (
    <KbsShell active="Claim Detail">
      <article>
        <h2>{claim.text}</h2>
        <p>Status: {claim.status}</p>
        <p>Domain: {claim.domain}</p>
        <p>Confidence: {Math.round(claim.confidence * 100)}%</p>
        <p>Citations: {claim.citations.length}</p>
        {claim.blockedReason ? <p>Blocked reason: {claim.blockedReason}</p> : null}
      </article>
    </KbsShell>
  );
}
