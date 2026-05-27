import { offlineRuntimeState } from "../runtime/offline-runtime";

export function OfflineRuntimeBanner() {
  return (
    <div style={{ border: "1px solid #334155", background: "#0f172a", color: "#e2e8f0", padding: 12, borderRadius: 8 }}>
      <strong>{offlineRuntimeState.status}</strong> · {offlineRuntimeState.reason}
    </div>
  );
}
