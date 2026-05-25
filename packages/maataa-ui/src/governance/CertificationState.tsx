import { RuntimeSurface } from "../components/status/RuntimeSurface";
export function CertificationState() { return <RuntimeSurface title="Certification State" subtitle="UI Runtime is not Scientific Certification" stats={[{ label: "Scientific Certification", value: "Blocked", tone: "degraded" }]} />; }
