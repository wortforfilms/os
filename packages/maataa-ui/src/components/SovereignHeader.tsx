import { maataaUiLaunchReadiness } from "../data/launch-readiness";
import { HonestStatusBadge } from "./HonestStatusBadge";

export function SovereignHeader() {
  return (
    <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", padding: "20px 0", borderBottom: "1px solid #1f2937" }}>
      <div>
        <div style={{ color: "#d6a55c", fontSize: 28, fontWeight: 900 }}>Maataa / Vaigyaaniq</div>
        <div style={{ color: "#94a3b8", fontSize: 13 }}>Sovereign runtime UI release candidate</div>
      </div>
      <HonestStatusBadge status={maataaUiLaunchReadiness.phkdVerdict === "BLOCKED" ? "BLOCKED" : "VERIFYING"} />
    </header>
  );
}
