import type { HonestStatusBadgeValue } from "./governance";

export interface RuntimeHealthMetric {
  id: string;
  label: string;
  value: string;
  status: HonestStatusBadgeValue;
}

export interface RuntimeModule {
  id: string;
  title: string;
  description: string;
  route: string;
  statusBadge: HonestStatusBadgeValue;
  readinessReason: string;
  offlineAvailability: boolean;
  blockedReason: string | null;
}

export interface OfflineRuntimeState {
  offlineMode: true;
  networkRequired: false;
  status: "OFFLINE" | "DEGRADED";
  reason: string;
}
