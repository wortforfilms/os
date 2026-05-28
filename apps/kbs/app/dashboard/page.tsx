import React from "react";
import { kbsClaims, kbsRuntimeBoard, kbsSources, summarizeKbsRuntimeBoard } from "../../../../packages/kbs-runtime/src";
import { KbsMetricGrid, KbsShell } from "../../components/KbsShell";

export default function KbsDashboardPage() {
  const runtimeSummary = summarizeKbsRuntimeBoard();
  const blockedClaims = kbsClaims.filter((claim) => claim.status === "BLOCKED");
  return (
    <KbsShell active="Dashboard">
      <section className="kbs-hero">
        <p>Welcome to</p>
        <h2>KBS Dashboard</h2>
        <p>Truth Layer for Civilization. Governed. Evidence Based. PHKD Aligned.</p>
      </section>
      <KbsMetricGrid />
      <section>
        <h2>Runtime Health</h2>
        <p>{runtimeSummary.healthScore}% health across {runtimeSummary.totalRuntimes} governed runtimes.</p>
        <p>Operational: {runtimeSummary.OPERATIONAL} Degraded: {runtimeSummary.DEGRADED} Maintenance: {runtimeSummary.MAINTENANCE} Offline: {runtimeSummary.OFFLINE}</p>
      </section>
      <section>
        <h2>Recent Sources</h2>
        {kbsSources.slice(0, 5).map((source) => <article key={source.id}>{source.title} - {source.status}</article>)}
      </section>
      <section>
        <h2>Blocked Claims</h2>
        {blockedClaims.map((claim) => <article key={claim.id}>{claim.text} - {claim.blockedReason}</article>)}
      </section>
      <section>
        <h2>Quick Actions</h2>
        {["Add Knowledge", "Add Source", "Add Claim", "Add Evidence", "Start Review", "Explore Graph", "Generate Report", "Export Data", "System Settings"].map((action) => (
          <button key={action} type="button">{action}</button>
        ))}
      </section>
      <section>
        <h2>Runtime Sample</h2>
        {kbsRuntimeBoard.slice(0, 6).map((runtime) => <article key={runtime.id}>{runtime.id}. {runtime.name} - {runtime.status}</article>)}
      </section>
    </KbsShell>
  );
}
