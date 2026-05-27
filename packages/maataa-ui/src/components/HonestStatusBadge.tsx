import type { HonestStatusBadgeValue } from "../types/governance";

const BADGE_COLORS: Record<HonestStatusBadgeValue, string> = {
  READY: "#0f766e",
  PREVIEW: "#2563eb",
  BLOCKED: "#991b1b",
  OFFLINE: "#334155",
  VERIFYING: "#a16207",
  DEGRADED: "#92400e",
};

export function HonestStatusBadge({ status }: { status: HonestStatusBadgeValue }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        background: BADGE_COLORS[status],
        color: "white",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 0,
        lineHeight: 1,
        padding: "6px 9px",
      }}
    >
      {status}
    </span>
  );
}
