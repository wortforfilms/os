import React from "react";
import { kbsSources } from "../../../../packages/kbs-runtime/src";
import { KbsShell } from "../../components/KbsShell";

export default function SourcesPage() {
  return (
    <KbsShell active="Sources">
      {kbsSources.map((source) => (
        <article key={source.id}>
          <h2>{source.title}</h2>
          <p>{source.type} - {source.trustLevel} - {source.status}</p>
        </article>
      ))}
    </KbsShell>
  );
}
