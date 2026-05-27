import type { CSSProperties } from "react";

const wall = {
  title: "Maataa Ecosystem Wall",
  domains: ["Lipi", "Krishi", "Education", "Health", "ALLB", "Radio", "Proof", "Production Workflows", "Media Intelligence"],
  center: ["TLP", "KBM", "Maataa"],
  foundation: ["Identity Runtime", "Interaction Runtime", "Session Runtime", "Knowledge Runtime", "Artifact Runtime", "Adaptive Runtime", "Security Layer"],
  technologies: ["TypeScript", "Electron", "React", "MediaPipe", "Whisper", "Ollama", "Vector DB", "Graph DB", "Local AI", "WASM", "PWA Ready", "Offline First"],
};

export function MaataaEcosystemWall() {
  return (
    <section style={shellStyle} aria-label="Maataa ecosystem wall">
      <header style={headerStyle}>
        <div>
          <p style={kickerStyle}>Sovereign · Adaptive · Multimodal · Local-First · Human-Centered</p>
          <h2 style={titleStyle}>{wall.title}</h2>
        </div>
        <strong style={statusStyle}>GOVERNED_PRODUCTION_NO_GO</strong>
      </header>
      <div style={centerStyle}>
        {wall.center.map((item) => (
          <article key={item} style={centerCardStyle}>{item}</article>
        ))}
      </div>
      <div style={gridStyle}>
        {wall.domains.map((domain) => (
          <article key={domain} style={cardStyle}>
            <h3>{domain}</h3>
            <p>Preview capability surface extracted from the ecosystem wall.</p>
          </article>
        ))}
      </div>
      <div style={stripStyle}>
        {wall.foundation.map((layer) => <span key={layer}>{layer}</span>)}
      </div>
      <div style={techStyle}>
        {wall.technologies.map((tech) => <code key={tech}>{tech}</code>)}
      </div>
    </section>
  );
}

const shellStyle = { display: "grid", gap: 18, padding: 22, border: "1px solid rgba(197,198,199,.14)", borderRadius: 8, background: "rgba(5,8,22,.92)", color: "#e8eeeb" } satisfies CSSProperties;
const headerStyle = { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start" } satisfies CSSProperties;
const kickerStyle = { margin: 0, color: "#d6a55c", fontSize: 11, fontWeight: 900, textTransform: "uppercase" } satisfies CSSProperties;
const titleStyle = { margin: "4px 0", color: "white", fontSize: 30 } satisfies CSSProperties;
const statusStyle = { color: "#ffb4b4", border: "1px solid rgba(255,96,96,.4)", borderRadius: 8, padding: "10px 12px", background: "rgba(82,11,18,.35)" } satisfies CSSProperties;
const centerStyle = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 } satisfies CSSProperties;
const centerCardStyle = { padding: 18, textAlign: "center", border: "1px solid rgba(0,194,255,.35)", borderRadius: 8, background: "rgba(0,80,130,.16)", color: "#66fcf1", fontWeight: 900 } satisfies CSSProperties;
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 } satisfies CSSProperties;
const cardStyle = { padding: 14, border: "1px solid rgba(197,198,199,.14)", borderRadius: 8, background: "rgba(11,18,36,.78)" } satisfies CSSProperties;
const stripStyle = { display: "flex", flexWrap: "wrap", gap: 8 } satisfies CSSProperties;
const techStyle = { display: "flex", flexWrap: "wrap", gap: 8 } satisfies CSSProperties;
