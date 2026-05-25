import { RuntimeRecovery } from "../../core/RuntimeRecovery";
import { RuntimeSurface } from "../../components/status/RuntimeSurface";
import type { RuntimeObservatoryEvidence } from "../loaders/loadRuntimeObservatoryEvidence";

export function ValidationHistoryPanel({ evidence }: { evidence: RuntimeObservatoryEvidence }) {
  if (evidence.status === "BLOCKED") {
    return <RuntimeRecovery reason={evidence.reason} />;
  }

  return (
    <RuntimeSurface
      title="Validation History"
      subtitle="Local manifest and MOSF status checks"
      stats={[
        { label: "Governance", value: evidence.governanceState, tone: "nominal" },
        { label: "SHA256SUMS", value: "OK", tone: "nominal" },
        { label: "MOSF", value: `0x${evidence.aiBatchStatus.toString(16).padStart(8, "0")}`, tone: "nominal" },
        { label: "Datasets", value: evidence.datasets.length, tone: "nominal" },
      ]}
    />
  );
}
