import { RuntimeSurface } from "../components/status/RuntimeSurface";

export function EphemerisObservatory() {
  return (
    <RuntimeSurface
      title="Ephemeris Observatory"
      subtitle="Scientific certification remains gated"
      stats={[{ label: "Certification", value: "Blocked", tone: "degraded" }]}
    />
  );
}
