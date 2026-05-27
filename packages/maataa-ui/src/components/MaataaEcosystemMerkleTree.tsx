import type { CSSProperties } from "react";

const ecosystemTree = {
  title: "Maataa Ecosystem",
  subtitle: "Merkle data tree for all frames with relations",
  root: { hash: "0x7A3F...91BC" },
  governance: {
    productionReady: false,
    finalStatus: "GOVERNED_PRODUCTION_NO_GO",
  },
  domains: [
    { id: "runtime", index: "01", title: "Runtime", hash: "0xA11B...3C9E", description: "Core Operational Engine", frames: [["01.1", "Status Matrix", "0x111...a1"], ["01.2", "Topology", "0x112...b2"], ["01.3", "Evolution", "0x113...c3"], ["01.4", "Replay", "0x114...d4"]] },
    { id: "production-tlp", index: "02", title: "Production (TLP)", hash: "0xB21C...7D4F", description: "Production OS", frames: [["02.1", "CreatorBoard", "0x211...a1"], ["02.2", "Timeline", "0x212...b2"], ["02.3", "Call Sheet", "0x213...c3"], ["02.4", "Assets", "0x214...d4"]] },
    { id: "distribution-radio", index: "03", title: "Distribution (Radio)", hash: "0xC31D...8E5A", description: "Independent Distribution", frames: [["03.1", "Releases", "0x311...a1"], ["03.2", "Lyrics Runtime", "0x312...b2"], ["03.3", "Playback", "0x313...c3"], ["03.4", "Entitlements", "0x314...d4"]] },
    { id: "knowledge-kbm", index: "04", title: "Knowledge (KBM)", hash: "0xD41E...9F6B", description: "Knowledge Memory Graph", frames: [["04.1", "Ingestion", "0x411...a1"], ["04.2", "Graph View", "0x412...b2"], ["04.3", "Provenance", "0x413...c3"], ["04.4", "Entities", "0x414...d4"]] },
    { id: "lipi-publishing", index: "05", title: "Lipi (Publishing)", hash: "0xE51F...A07C", description: "Scripts & Languages", frames: [["05.1", "Script Explorer", "0x511...a1"], ["05.2", "Script Timeline", "0x512...b2"], ["05.3", "Transliteration", "0x513...c3"], ["05.4", "Manuscripts", "0x514...d4"]] },
    { id: "community", index: "06", title: "Community", hash: "0xF620...B10D", description: "People & Purpose", frames: [["06.1", "Community Home", "0x611...a1"], ["06.2", "Missions", "0x612...b2"], ["06.3", "Live Sessions", "0x613...c3"], ["06.4", "Discussions", "0x614...d4"]] },
    { id: "documentation", index: "07", title: "Documentation", hash: "0x0711...C29E", description: "Guides & References", frames: [["07.1", "Docs", "0x711...a1"], ["07.2", "Guides", "0x712...b2"], ["07.3", "API", "0x713...c3"], ["07.4", "References", "0x714...d4"]] },
    { id: "allb-ecosystem", index: "08", title: "ALLB Ecosystem", hash: "0x1822...D3AF", description: "Commerce - Media - Infra", frames: [["08.1", "ALLB Shop", "0x811...a1"], ["08.2", "B2A Exchange", "0x812...b2"], ["08.3", "Krishi", "0x813...c3"], ["08.4", "CIC", "0x814...d4"]] },
  ],
};

export function MaataaEcosystemMerkleTree() {
  return (
    <section style={shellStyle} aria-label="Maataa ecosystem Merkle tree">
      <header style={headerStyle}>
        <div>
          <p style={kickerStyle}>Merkle Data Tree</p>
          <h2 style={titleStyle}>{ecosystemTree.title}</h2>
          <p style={copyStyle}>{ecosystemTree.subtitle}</p>
        </div>
        <div style={hashStyle}>
          <span>Root Hash</span>
          <strong>{ecosystemTree.root.hash}</strong>
          <small>image-derived, not verified</small>
        </div>
      </header>
      <div style={statusStyle}>
        <strong>{ecosystemTree.governance.finalStatus}</strong>
        <span>{ecosystemTree.governance.productionReady ? "Production ready" : "Production blocked"}</span>
      </div>
      <div style={domainGridStyle}>
        {ecosystemTree.domains.map((domain) => (
          <article key={domain.id} style={cardStyle}>
            <header style={cardHeaderStyle}>
              <span>{domain.index}</span>
              <code>{domain.hash}</code>
            </header>
            <h3 style={cardTitleStyle}>{domain.title}</h3>
            <p style={copyStyle}>{domain.description}</p>
            <ul style={listStyle}>
              {domain.frames.map(([id, label, hash]) => (
                <li key={id}>
                  <span>{id} {label}</span>
                  <code>{hash}</code>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

const shellStyle = {
  display: "grid",
  gap: 18,
  padding: 22,
  border: "1px solid rgba(197, 198, 199, 0.14)",
  borderRadius: 8,
  background: "rgba(5, 8, 22, 0.92)",
  color: "#e8eeeb",
} satisfies CSSProperties;

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 18,
} satisfies CSSProperties;

const kickerStyle = {
  margin: 0,
  color: "#d6a55c",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
} satisfies CSSProperties;

const titleStyle = { margin: "4px 0", color: "white", fontSize: 28 } satisfies CSSProperties;
const copyStyle = { margin: 0, color: "#b7c5c1", lineHeight: 1.5 } satisfies CSSProperties;

const hashStyle = {
  minWidth: 230,
  display: "grid",
  gap: 6,
  padding: 14,
  border: "1px solid rgba(214, 165, 92, 0.34)",
  borderRadius: 8,
  background: "rgba(214, 165, 92, 0.08)",
} satisfies CSSProperties;

const statusStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: 12,
  border: "1px solid rgba(255, 96, 96, 0.4)",
  borderRadius: 8,
  background: "rgba(82, 11, 18, 0.35)",
  color: "#ffb4b4",
} satisfies CSSProperties;

const domainGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: 12,
} satisfies CSSProperties;

const cardStyle = {
  display: "grid",
  gap: 10,
  padding: 14,
  border: "1px solid rgba(197, 198, 199, 0.14)",
  borderRadius: 8,
  background: "rgba(11, 18, 36, 0.78)",
} satisfies CSSProperties;

const cardHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  color: "#66fcf1",
  fontSize: 11,
} satisfies CSSProperties;

const cardTitleStyle = { margin: 0, color: "white", fontSize: 17 } satisfies CSSProperties;

const listStyle = {
  display: "grid",
  gap: 5,
  margin: 0,
  padding: 0,
  listStyle: "none",
  fontSize: 11,
} satisfies CSSProperties;
