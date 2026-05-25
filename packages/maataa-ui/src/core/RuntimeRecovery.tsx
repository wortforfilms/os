import { RuntimeSurface } from "../components/status/RuntimeSurface";

export function RuntimeRecovery({ reason = "Recovery console armed" }: { reason?: string }) {
  return (
    <RuntimeSurface
      title="Recovery Console"
      subtitle={reason}
      stats={[{ label: "Mode", value: "Isolated", tone: "recovery" }]}
    />
  );
}
