import type { AamJantaaLanguageCode } from "../types/aam-jantaa";
import { languageInterfaceMatrix } from "../data/language-interface-matrix";
import { FeatureEntryCard } from "./FeatureEntryCard";
import { OfflineRuntimeBanner } from "./OfflineRuntimeBanner";
import { RuntimeHealthPanel } from "./RuntimeHealthPanel";
import { EvidencePanel } from "./EvidencePanel";
import { BlockedReasonView } from "./BlockedReasonView";

export function AamJantaaInterface({ language = "hi" }: { language?: AamJantaaLanguageCode }) {
  const selectedLanguage = languageInterfaceMatrix.languages.find((entry) => entry.code === language) ?? languageInterfaceMatrix.languages[0];

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <section style={{ color: "white" }}>
        <h1 style={{ marginBottom: 4 }}>Aam Jantaa Interface</h1>
        <div style={{ color: "#94a3b8" }}>{selectedLanguage.nativeLabel} · governed release candidate · no production GO claim</div>
      </section>
      <OfflineRuntimeBanner />
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {languageInterfaceMatrix.features.map((feature) => (
          <FeatureEntryCard key={feature.id} feature={feature} language={selectedLanguage.code} />
        ))}
      </section>
      <RuntimeHealthPanel />
      <EvidencePanel />
      <BlockedReasonView />
    </main>
  );
}
