import React from "react";
import { kbsClaims, kbsSources, keywordSearch } from "../../../../packages/kbs-runtime/src";
import { KbsShell } from "../../components/KbsShell";

export default function SearchPage() {
  const results = keywordSearch("brahmi", kbsClaims, kbsSources);
  return (
    <KbsShell active="Search">
      <label>Search <input defaultValue="brahmi" /></label>
      <p>{results.length === 0 ? "MISSING_DATA" : `${results.length} local results`}</p>
      {results.map((result) => <article key={result.id}>{result.id}</article>)}
    </KbsShell>
  );
}
