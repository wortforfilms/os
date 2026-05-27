import type { AamJantaaFeature, AamJantaaLanguageCode } from "../types/aam-jantaa";
import { HonestStatusBadge } from "./HonestStatusBadge";

export function FeatureEntryCard({ feature, language = "hi" }: { feature: AamJantaaFeature; language?: AamJantaaLanguageCode }) {
  return (
    <article style={{ border: "1px solid #243244", borderRadius: 8, padding: 14, background: "#0b1220" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
        <div>
          <h3 style={{ margin: 0, color: "white", fontSize: 16 }}>{feature.languageLabels[language]}</h3>
          <div style={{ color: "#94a3b8", fontSize: 12 }}>{feature.title}</div>
        </div>
        <HonestStatusBadge status={feature.statusBadge} />
      </div>
      <p style={{ color: "#cbd5e1", fontSize: 13 }}>{feature.description}</p>
      <div style={{ color: "#94a3b8", fontSize: 12 }}>Offline: {feature.offlineAvailability ? "yes" : "no"}</div>
      {feature.blockedReason ? <div style={{ color: "#fecaca", fontSize: 12, marginTop: 8 }}>{feature.blockedReason}</div> : null}
    </article>
  );
}
