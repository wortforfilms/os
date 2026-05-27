import { maataaUiLaunchReadiness } from "../data/launch-readiness";
import { HonestStatusBadge } from "./HonestStatusBadge";

export function EvidencePanel() {
  return (
    <section style={{ border: "1px solid #243244", borderRadius: 8, padding: 16, background: "#0b1220" }}>
      <h2 style={{ marginTop: 0, color: "white" }}>Evidence Matrix</h2>
      {maataaUiLaunchReadiness.evidence.map((item) => (
        <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, borderTop: "1px solid #1f2937", padding: "10px 0" }}>
          <div>
            <div style={{ color: "white", fontWeight: 800 }}>{item.label}</div>
            <div style={{ color: "#94a3b8", fontSize: 12 }}>{item.reason}</div>
          </div>
          <HonestStatusBadge status={item.status} />
        </div>
      ))}
    </section>
  );
}
