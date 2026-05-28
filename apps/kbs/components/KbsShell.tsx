import React from "react";
import {
  kbsClaims,
  kbsGovernanceState,
  kbsGraphEdges,
  kbsGraphNodes,
  kbsSources
} from "../../../packages/kbs-runtime/src";

export const kbsNavigation = [
  ["Home", "/"],
  ["Dashboard", "/dashboard"],
  ["All Runtimes", "/all-runtimes"],
  ["Knowledge", "/knowledge"],
  ["Sources", "/sources"],
  ["Claims", "/claims"],
  ["Domains", "/domains"],
  ["Graph", "/graph"],
  ["Search", "/search"],
  ["Review Queue", "/review-queue"],
  ["Governance", "/governance"],
  ["Evidence", "/evidence"],
  ["Reports", "/reports"],
  ["API & SDK", "/api-sdk"],
  ["Settings", "/settings"]
] as const;

export const kbsDomains = [
  "Lipi",
  "TLP",
  "Maataa",
  "Radio",
  "Brahmini",
  "Saptadhaatu",
  "Ayurveda",
  "Astronomy",
  "Culture",
  "Legal",
  "Technical",
  "Education"
] as const;

export interface KbsShellProps {
  active: string;
  children: React.ReactNode;
}

export function KbsShell({ active, children }: KbsShellProps) {
  return (
    <main className="kbs-shell" data-final-status={kbsGovernanceState.finalStatus}>
      <aside aria-label="KBS navigation">
        <div className="kbs-logo">KBS</div>
        <nav>
          {kbsNavigation.map(([label, path]) => (
            <a key={path} aria-current={label === active ? "page" : undefined} href={`/kbs${path === "/" ? "" : path}`}>
              {label}
            </a>
          ))}
        </nav>
        <section aria-label="KBS status">
          <strong>KBS Status</strong>
          <span>{kbsGovernanceState.finalStatus}</span>
          <span>{kbsGovernanceState.blockers.length} blockers</span>
        </section>
      </aside>
      <section className="kbs-content">
        <header>
          <div>
            <p>Knowledge Base System</p>
            <h1>{active}</h1>
          </div>
          <span className="kbs-badge">PHKD MODE: HONEST</span>
        </header>
        {children}
      </section>
    </main>
  );
}

export function KbsMetricGrid() {
  const verified = kbsClaims.filter((claim) => claim.status === "VERIFIED").length;
  return (
    <section className="kbs-metrics" aria-label="KBS metrics">
      <article><strong>{kbsSources.length}</strong><span>Sources</span></article>
      <article><strong>{kbsClaims.length}</strong><span>Claims</span></article>
      <article><strong>{verified}</strong><span>Verified Claims</span></article>
      <article><strong>{kbsDomains.length}</strong><span>Domains</span></article>
      <article><strong>{kbsGraphNodes.length}</strong><span>Graph Nodes</span></article>
      <article><strong>{kbsGraphEdges.length}</strong><span>Graph Edges</span></article>
    </section>
  );
}

export function KbsBlockedPanel() {
  return (
    <section className="kbs-blocked" aria-label="KBS production blockers">
      <h2>Production Gate</h2>
      <p>GOVERNED_PRODUCTION_NO_GO remains active until every hardware, signer, quorum, rollback, moderation, public trust, and account safety gate has real evidence.</p>
      <ul>
        {kbsGovernanceState.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
      </ul>
    </section>
  );
}
