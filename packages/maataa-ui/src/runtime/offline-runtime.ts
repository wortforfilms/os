import type { OfflineRuntimeState } from "../types/runtime";

export const offlineRuntimeState: OfflineRuntimeState = {
  offlineMode: true,
  networkRequired: false,
  status: "OFFLINE",
  reason: "Aam Jantaa interface can render without external APIs; production release remains blocked.",
};
