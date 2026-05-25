import { RuntimeSurface } from "../components/status/RuntimeSurface";
import { useRuntimeSnapshot } from "./RuntimeProvider";

export function RuntimeHealth() {
  const snapshot = useRuntimeSnapshot();
  return (
    <RuntimeSurface
      title="Runtime Health"
      subtitle={snapshot.health}
      stats={[
        { label: "Mode", value: snapshot.mode, tone: snapshot.health },
        { label: "Governance", value: snapshot.governanceState, tone: snapshot.health },
      ]}
    />
  );
}
