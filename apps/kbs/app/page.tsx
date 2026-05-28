import React from "react";
import { kbsClaims, kbsSources } from "../../../packages/kbs-runtime/src";
import { KbsBlockedPanel, kbsDomains, KbsMetricGrid, KbsShell } from "../components/KbsShell";

export default function KbsHomePage() {
  return (
    <KbsShell active="Home">
      <section className="kbs-hero">
        <p>Welcome to</p>
        <h2>KBS Knowledge Base System</h2>
        <p>Truth Layer for Civilization. Governed. Evidence Based. PHKD Aligned.</p>
        <a href="/kbs/knowledge">Explore Knowledge</a>
      </section>
      <KbsMetricGrid />
      <section>
        <h2>Knowledge Domains</h2>
        <div className="kbs-card-grid">
          {kbsDomains.map((domain) => <article key={domain}>{domain}</article>)}
        </div>
      </section>
      <section>
        <h2>Recent Sources</h2>
        {kbsSources.map((source) => <article key={source.id}>{source.title} - {source.status}</article>)}
      </section>
      <section>
        <h2>Claim Review Summary</h2>
        {kbsClaims.map((claim) => <article key={claim.id}>{claim.text} - {claim.status}</article>)}
      </section>
      <KbsBlockedPanel />
    </KbsShell>
  );
}
