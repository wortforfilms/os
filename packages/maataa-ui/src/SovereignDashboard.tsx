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

const navItems = ["Runtime", "Observatory", "Lipi", "Radio", "TLP", "Governance"] as const;

const statusMetrics = [
  { label: "System Word", value: "0x001B004F", tone: "gold" },
  { label: "Loopback", value: "127.0.0.1:1420", tone: "cyan" },
  { label: "Release Gate", value: "PREVIEW", tone: "amber" },
  { label: "Assets HTML", value: "ISOLATED", tone: "green" },
] as const;

export function SovereignDashboard() {
  return (
    <div className="sovereign-dashboard">
      <aside className="sovereign-rail" aria-label="Maataa OS navigation">
        <div className="brand-mark">M</div>
        <nav className="rail-nav">
          {navItems.map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`}>
              {item}
            </a>
          ))}
        </nav>
        <div className="rail-footer">
          <span>PHKD</span>
          <strong>LOCAL</strong>
        </div>
      </aside>

      <main className="sovereign-main">
        <header className="sovereign-header">
          <div>
            <p className="dashboard-kicker">Maataa OS Cockpit</p>
            <h1>Design tomorrow's realities.</h1>
            <p className="dashboard-lede">
              Sovereign runtime, observatory evidence, cultural knowledge systems, local media operations, and controlled release gates in one
              desktop-grade cockpit.
            </p>
          </div>
          <div className="release-stamp" aria-label="Current release posture">
            <span>PRODUCT STATE</span>
            <strong>QEMU ALPHA</strong>
            <small>Production claims blocked until gates pass.</small>
          </div>
        </header>

        <section className="status-strip" aria-label="Runtime status summary">
          {statusMetrics.map((metric) => (
            <div className={`status-tile ${metric.tone}`} key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </section>

        <section className="dashboard-band primary-band" id="runtime" aria-label="Core runtime">
          <DashboardPanel span="wide" title="Core Runtime">
            <GenesisModule />
          </DashboardPanel>
          <DashboardPanel title="Orchestration">
            <OrchestrationLayer />
          </DashboardPanel>
          <DashboardPanel title="Monorepo">
            <MonorepoSovereignty />
          </DashboardPanel>
        </section>

        <section className="dashboard-band" id="observatory" aria-label="Observatory and completion systems">
          <DashboardPanel title="Completion">
            <CompletionRuntime />
          </DashboardPanel>
          <DashboardPanel span="wide" title="Observatory">
            <RuntimeObservatory />
          </DashboardPanel>
          <DashboardPanel title="UI Runtime">
            <MaataaUiPanel />
          </DashboardPanel>
        </section>

        <section className="dashboard-band operations-band" aria-label="Operations systems">
          <DashboardPanel title="Offline Boundary">
            <OfflineSovereignty />
          </DashboardPanel>
          <DashboardPanel title="Ayodhya Studio">
            <AyodhyaStudio />
          </DashboardPanel>
          <DashboardPanel span="tall" title="Radio Vaigyaaniq">
            <RadioRuntime />
          </DashboardPanel>
          <DashboardPanel title="Communication">
            <CommunicationCore />
          </DashboardPanel>
          <DashboardPanel title="TLP Evolution">
            <TlpEvolution />
          </DashboardPanel>
        </section>

        <section className="dashboard-band knowledge-band" id="lipi" aria-label="Knowledge and ledger systems">
          <DashboardPanel span="wide" title="Lipi Civilization">
            <LipiCivilization />
          </DashboardPanel>
          <DashboardPanel title="Chakra">
            <ChakraConsciousness />
          </DashboardPanel>
          <DashboardPanel title="Brahmini">
            <BrahminiChain />
          </DashboardPanel>
        </section>

        <section className="dashboard-band governance-band" id="governance" aria-label="Governance systems">
          <DashboardPanel span="wide" danger title="Scientific Governance">
            <ScientificGovernance />
          </DashboardPanel>
          <DashboardPanel title="Remaining Gaps">
            <RemainingGaps />
          </DashboardPanel>
          <div className="closing-panel">
            <span>TATHAASTU</span>
            <strong>Pure. Honest. Kabir. Driven.</strong>
          </div>
        </section>
      </main>
    </div>
  );
}

function DashboardPanel({
  title,
  span = "normal",
  danger = false,
  children,
}: {
  title: string;
  span?: "normal" | "wide" | "tall";
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <article className={`dashboard-panel ${span} ${danger ? "danger" : ""}`} aria-label={title}>
      {children}
    </article>
  );
}
