import { AamJantaaInterface } from "./AamJantaaInterface";
import { SovereignHeader } from "./SovereignHeader";
import { SovereignFooter } from "./SovereignFooter";

export function CinematicHomepage() {
  return (
    <div style={{ minHeight: "100vh", background: "#050816", color: "#e2e8f0", padding: 24, fontFamily: "Inter, system-ui, sans-serif" }}>
      <SovereignHeader />
      <AamJantaaInterface language="hi" />
      <SovereignFooter />
    </div>
  );
}
