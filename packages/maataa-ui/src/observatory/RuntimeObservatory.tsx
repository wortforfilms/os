import { defaultRuntimeSnapshot } from "../config";
import { RuntimeSurface } from "../components/status/RuntimeSurface";

export function RuntimeObservatory() {
  return (
    <RuntimeSurface
      title="Runtime Observatory"
      subtitle="Local evidence and promotion state"
      stats={defaultRuntimeSnapshot.stats}
    />
  );
}
