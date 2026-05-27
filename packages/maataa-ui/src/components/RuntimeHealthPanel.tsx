import { runtimeHealthMetrics } from "../runtime/runtime-status";
import { HonestStatusBadge } from "./HonestStatusBadge";

export function RuntimeHealthPanel() {
  return (
    <section style={{ border: "1px solid #243244", borderRadius: 8, padding: 16, background: "#08111f" }}>
      <h2 style={{ marginTop: 0, color: "white" }}>Runtime Health</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        {runtimeHealthMetrics.map((metric) => (
          <div key={metric.id} style={{ border: "1px solid #1f2937", borderRadius: 8, padding: 10 }}>
            <div style={{ color: "#94a3b8", fontSize: 12 }}>{metric.label}</div>
            <div style={{ color: "white", fontWeight: 800 }}>{metric.value}</div>
            <HonestStatusBadge status={metric.status} />
          </div>
        ))}
      </div>
    </section>
  );
}
