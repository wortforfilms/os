import type { ReactNode } from "react";
import {
  AyodhyaStudio,
  BrahminiChain,
  ChakraConsciousness,
  CommunicationCore,
  CompletionRuntime,
  GenesisModule,
  LipiCivilization,
  MaataaUiPanel,
  MonorepoSovereignty,
  OfflineSovereignty,
  OrchestrationLayer,
  RadioRuntime,
  RemainingGaps,
  RuntimeObservatory,
  ScientificGovernance,
  TlpEvolution,
} from "./widgets";

const panelStyle = {
  border: "1px solid #1f2833",
  background: "#0b1224",
  padding: 12,
  borderRadius: 8,
  minWidth: 0,
} as const;

export function SovereignDashboard() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
        gap: 16,
        padding: 16,
        background: "#050816",
        color: "#c5c6c7",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
    >
      <header
        style={{
          gridColumn: "1 / -1",
          textAlign: "center",
          borderBottom: "1px solid #1f2833",
          paddingBottom: 16,
          marginBottom: 4,
        }}
      >
        <h1 style={{ margin: 0, color: "#d6a55c", fontSize: 30, letterSpacing: 4 }}>MAATAA-OS</h1>
        <p style={{ margin: "6px 0 0", color: "#00c2ff", fontSize: 12, textTransform: "uppercase" }}>
          Sovereign Operating Ecosystem - A Living Civilizational Runtime
        </p>
        <div style={{ color: "#45a29e", fontSize: 10, marginTop: 4 }}>PHKD - PURE HONEST KABIR DRIVEN</div>
      </header>

      <Panel span={3}>
        <GenesisModule />
      </Panel>
      <Panel span={3}>
        <OrchestrationLayer />
      </Panel>
      <Panel span={3}>
        <MonorepoSovereignty />
      </Panel>
      <Panel span={3}>
        <MaataaUiPanel />
      </Panel>

      <Panel span={3}>
        <CompletionRuntime />
      </Panel>
      <Panel span={3}>
        <RuntimeObservatory />
      </Panel>
      <Panel span={2}>
        <OfflineSovereignty />
      </Panel>
      <Panel span={2}>
        <AyodhyaStudio />
      </Panel>
      <Panel span={2}>
        <RadioRuntime />
      </Panel>

      <Panel span={3}>
        <CommunicationCore />
      </Panel>
      <Panel span={3}>
        <LipiCivilization />
      </Panel>
      <Panel span={2}>
        <ChakraConsciousness />
      </Panel>
      <Panel span={2}>
        <BrahminiChain />
      </Panel>
      <Panel span={2}>
        <TlpEvolution />
      </Panel>

      <Panel span={4} danger>
        <ScientificGovernance />
      </Panel>
      <Panel span={5}>
        <RemainingGaps />
      </Panel>
      <div
        style={{
          ...panelStyle,
          gridColumn: "span 3",
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          background: "#050816",
        }}
      >
        <div>
          <strong style={{ display: "block", color: "#d6a55c", fontSize: 18 }}>TATHAASTU</strong>
          <span style={{ color: "#45a29e", fontSize: 10, textTransform: "uppercase" }}>Built with Devotion - Driven by Dharma</span>
        </div>
      </div>
    </div>
  );
}

function Panel({ span, danger, children }: { span: number; danger?: boolean; children: ReactNode }) {
  return (
    <div
      style={{
        ...panelStyle,
        gridColumn: `span ${span}`,
        borderColor: danger ? "#7f1d1d" : "#1f2833",
        background: danger ? "#030712" : panelStyle.background,
      }}
    >
      {children}
    </div>
  );
}
