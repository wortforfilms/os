import { languageInterfaceMatrix } from "../data/language-interface-matrix";

export function MobileCommandOverlay() {
  return (
    <nav style={{ display: "grid", gap: 8 }}>
      {languageInterfaceMatrix.features.map((feature) => (
        <a key={feature.id} href={feature.route} style={{ color: "#bfdbfe", textDecoration: "none" }}>
          {feature.title}
        </a>
      ))}
    </nav>
  );
}
