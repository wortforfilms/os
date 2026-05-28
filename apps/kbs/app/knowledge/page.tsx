import React from "react";
import { kbsClaims } from "../../../../packages/kbs-runtime/src";
import { KbsShell } from "../../components/KbsShell";

export default function KnowledgePage() {
  return (
    <KbsShell active="Knowledge">
      {kbsClaims.map((claim) => (
        <article key={claim.id}>
          <h2>{claim.text}</h2>
          <p>{claim.domain} - {claim.status} - confidence {Math.round(claim.confidence * 100)}%</p>
        </article>
      ))}
    </KbsShell>
  );
}
