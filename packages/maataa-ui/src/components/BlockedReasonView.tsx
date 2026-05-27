import { maataaUiLaunchReadiness } from "../data/launch-readiness";

export function BlockedReasonView() {
  return (
    <section style={{ border: "1px solid #7f1d1d", borderRadius: 8, padding: 16, background: "#1f0b0b", color: "#fee2e2" }}>
      <h2 style={{ marginTop: 0 }}>Production GO blocked</h2>
      <ul>
        {maataaUiLaunchReadiness.activeBlockers.map((blocker) => (
          <li key={blocker}>{blocker}</li>
        ))}
      </ul>
    </section>
  );
}
