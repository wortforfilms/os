import { HonestStatusBadge } from "./HonestStatusBadge";

export function MobileRuntimeStatus() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: "#e2e8f0", fontWeight: 800 }}>Runtime</span>
      <HonestStatusBadge status="BLOCKED" />
    </div>
  );
}
