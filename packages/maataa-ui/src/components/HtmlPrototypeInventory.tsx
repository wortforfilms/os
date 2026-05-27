import type { CSSProperties } from "react";

const prototypeGroups = [
  { label: "Boot", value: "Boot ritual, stage cards, system-ready banner", status: "PREVIEW" },
  { label: "Runtime", value: "Dashboard, monitor, holy screen, process table", status: "PREVIEW" },
  { label: "Workspace", value: "Desktop icons, windows, taskbar, context menu", status: "PREVIEW" },
  { label: "Avatar", value: "Emotion, phoneme, eye tracking, breathing controls", status: "PREVIEW" },
  { label: "Market", value: "Landing, features, sales, services, USP", status: "BLOCKED" },
  { label: "Onboarding", value: "Quick start flow and action cards", status: "PREVIEW" }
];

const contractRows = [
  "Frames",
  "Types",
  "Schemas",
  "Data frames",
  "Runtimes",
  "Workflows",
  "UI surfaces",
  "Widgets"
];

export function HtmlPrototypeInventory() {
  return (
    <section style={shellStyle} aria-label="HTML prototype absorption inventory">
      <header style={headerStyle}>
        <div>
          <p style={kickerStyle}>Local Prototype Absorption</p>
          <h2 style={titleStyle}>HTML Frames to Governed Runtime Contracts</h2>
          <p style={copyStyle}>
            Thirteen local HTML prototypes are represented as typed extraction records. Raw prototype files remain
            outside release sources and the production gate remains closed.
          </p>
        </div>
        <strong style={blockedStyle}>GOVERNED_PRODUCTION_NO_GO</strong>
      </header>

      <div style={statsStyle}>
        <span><b>13</b> prototype files</span>
        <span><b>9,549</b> source lines mapped</span>
        <span><b>8</b> contract categories</span>
        <span><b>0</b> raw HTML files promoted</span>
      </div>

      <div style={gridStyle}>
        {prototypeGroups.map((group) => (
          <article key={group.label} style={cardStyle}>
            <div style={cardHeaderStyle}>
              <h3 style={cardTitleStyle}>{group.label}</h3>
              <span style={group.status === "BLOCKED" ? blockedPillStyle : previewPillStyle}>{group.status}</span>
            </div>
            <p style={cardCopyStyle}>{group.value}</p>
          </article>
        ))}
      </div>

      <div style={contractStyle}>
        {contractRows.map((row) => (
          <code key={row} style={codeStyle}>{row}</code>
        ))}
      </div>
    </section>
  );
}

const shellStyle = { display: "grid", gap: 18, padding: 22, border: "1px solid rgba(197,198,199,.16)", borderRadius: 8, background: "rgba(4,10,18,.95)", color: "#edf5f2" } satisfies CSSProperties;
const headerStyle = { display: "flex", justifyContent: "space-between", gap: 18, alignItems: "start" } satisfies CSSProperties;
const kickerStyle = { margin: 0, color: "#d6a55c", fontSize: 11, fontWeight: 900, textTransform: "uppercase" } satisfies CSSProperties;
const titleStyle = { margin: "4px 0 8px", fontSize: 28, lineHeight: 1.1 } satisfies CSSProperties;
const copyStyle = { maxWidth: 760, margin: 0, color: "#b9c7c2", fontSize: 13, lineHeight: 1.55 } satisfies CSSProperties;
const blockedStyle = { flexShrink: 0, color: "#ffb4b4", border: "1px solid rgba(255,96,96,.45)", borderRadius: 8, padding: "10px 12px", background: "rgba(82,11,18,.38)", fontSize: 12 } satisfies CSSProperties;
const statsStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 } satisfies CSSProperties;
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 } satisfies CSSProperties;
const cardStyle = { padding: 14, border: "1px solid rgba(197,198,199,.14)", borderRadius: 8, background: "rgba(11,18,36,.78)" } satisfies CSSProperties;
const cardHeaderStyle = { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" } satisfies CSSProperties;
const cardTitleStyle = { margin: 0, fontSize: 15 } satisfies CSSProperties;
const cardCopyStyle = { margin: "10px 0 0", color: "#c7d3cf", fontSize: 12, lineHeight: 1.45 } satisfies CSSProperties;
const previewPillStyle = { border: "1px solid rgba(102,252,241,.35)", borderRadius: 999, padding: "4px 8px", color: "#66fcf1", fontSize: 10 } satisfies CSSProperties;
const blockedPillStyle = { border: "1px solid rgba(255,96,96,.45)", borderRadius: 999, padding: "4px 8px", color: "#ff9d9d", fontSize: 10 } satisfies CSSProperties;
const contractStyle = { display: "flex", flexWrap: "wrap", gap: 8 } satisfies CSSProperties;
const codeStyle = { padding: "7px 9px", borderRadius: 6, background: "rgba(0,194,255,.1)", color: "#9de8ff", border: "1px solid rgba(0,194,255,.18)" } satisfies CSSProperties;
