import React from "react";
import { kbsDomains, KbsShell } from "../../components/KbsShell";

export default function DomainsPage() {
  return (
    <KbsShell active="Domains">
      <div className="kbs-card-grid">{kbsDomains.map((domain) => <article key={domain}>{domain}</article>)}</div>
    </KbsShell>
  );
}
