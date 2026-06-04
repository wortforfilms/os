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
import { ProductionReadinessMatrix } from "./governance/ProductionReadinessMatrix";

type RuntimeStatusSnapshot = {
  state: "LIVE" | "DEGRADED" | "OFFLINE" | "BLOCKED";
  cursor: number;
  lastHeartbeatAt: number | null;
  recentEvents: Array<{
    id: number;
    type: string;
    at: number;
    title: string;
    detail: string;
    status: "LIVE" | "DEGRADED" | "OFFLINE" | "BLOCKED";
  }>;
  blockedSystemsCount: number;
  transport: "sse" | "electron-ipc" | "browser-fallback" | "none";
  stream: "sse" | "polling" | "fallback";
};

const navItems = ["Runtime", "Schematic", "Observatory", "Lipi", "Radio", "Governance"] as const;

const statusMetrics = [
  { label: "System Word", value: "0x001B004F", tone: "gold" },
  { label: "Loopback", value: "127.0.0.1:1420", tone: "cyan" },
  { label: "Release Gate", value: "PREVIEW", tone: "amber" },
  { label: "Assets HTML", value: "ISOLATED", tone: "green" },
] as const;

const ecosystemColumns = [
  {
    title: "apps/",
    subtitle: "Presentation Layers",
    items: ["desktop / Tauri wrapper", "web-console / localhost 1420", "device-lab / driver bench", "tlp-studios / production OS", "mobile / preview shell"],
  },
  {
    title: "crates/",
    subtitle: "Bare-Metal Engines",
    items: ["hemant-core / clocks + HSTS", "hemant-ephemeris / de440 + gaia", "hemant-panchanga / lunisolar", "hemant-evidence / signers", "hemant-topology / closed rings"],
  },
  {
    title: "packages/",
    subtitle: "Shared Runtimes & UI",
    items: ["maataa-ui / dashboard canvas", "evidence-runtime / binary decoders", "universal-runtime / central types", "cinematic-runtime / local drivers", "live-space-runtime / CV staging"],
  },
] as const;

const offlineCores = [
  ["Intelligence Core", "Ollama + DeepSeek", "STAGED"],
  ["Media Core", "FLUX + SDXL + ComfyUI", "STAGED"],
  ["Spatial 3D Core", "TripoSR + Hunyuan3D + R3F", "STAGED"],
  ["Computer Vision", "MediaPipe Holistic", "STAGED"],
  ["Acoustic Transform", "MusicGen strike engine", "STAGED"],
] as const;

const viewportQuadrants = [
  ["01 Systems Observatory", "Monotonic chrono + script metrics"],
  ["02 Deployment Topology", "SQLite/local loopback constraints"],
  ["03 Lipi Civilization", "Heritage alphabets + phonetic strike"],
  ["04 PHKD Gates", "Safety shields + release boundaries"],
] as const;

const archiveSteps = ["Integrity Check", "Cache Evacuation", "Hermetic Compact", "Local Mirror", "Sandbox Hygiene"] as const;

export function SovereignDashboard({ runtimeStatus }: { runtimeStatus?: RuntimeStatusSnapshot }) {
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

        {runtimeStatus ? <LiveRuntimeStatus snapshot={runtimeStatus} /> : null}

        <EcosystemSchematic />

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

        <section aria-label="Production hardening matrix">
          <ProductionReadinessMatrix />
        </section>
      </main>
    </div>
  );
}

function LiveRuntimeStatus({ snapshot }: { snapshot: RuntimeStatusSnapshot }) {
  return (
    <section className={`live-runtime-status ${snapshot.state.toLowerCase()}`} aria-label="Live runtime status">
      <header>
        <div>
          <p className="dashboard-kicker">Live Runtime Status</p>
          <h2>{snapshot.state}</h2>
        </div>
        <div className="live-runtime-meta">
          <span>stream: {snapshot.stream}</span>
          <span>transport: {snapshot.transport}</span>
          <span>cursor: {snapshot.cursor}</span>
          <span>blocked: {snapshot.blockedSystemsCount}</span>
        </div>
      </header>
      <div className="live-runtime-grid">
        <div>
          <span>Last heartbeat</span>
          <strong>{snapshot.lastHeartbeatAt ? new Date(snapshot.lastHeartbeatAt).toLocaleTimeString() : "OFFLINE"}</strong>
        </div>
        <div>
          <span>Reconnect posture</span>
          <strong>{snapshot.state === "LIVE" ? "armed" : snapshot.state === "DEGRADED" ? "fallback" : "blocked"}</strong>
        </div>
        <div>
          <span>Recent events</span>
          <strong>{snapshot.recentEvents.length}</strong>
        </div>
      </div>
      <ol className="live-event-list">
        {snapshot.recentEvents.slice(0, 4).map((event) => (
          <li key={event.id}>
            <time>{new Date(event.at).toLocaleTimeString()}</time>
            <span>{event.title}</span>
            <em>{event.status}</em>
          </li>
        ))}
      </ol>
    </section>
  );
}

function EcosystemSchematic() {
  return (
    <section className="ecosystem-schematic" id="schematic" aria-label="Full ecosystem schematic visualization matrix">
      <header className="schematic-header">
        <div>
          <p className="dashboard-kicker">Full Ecosystem Schematic</p>
          <h2>Relational skeleton tree mapped to local execution boundaries.</h2>
        </div>
        <div className="schematic-verdict">
          <span>Operational Truth</span>
          <strong>PREVIEW VERIFIED</strong>
        </div>
      </header>

      <div className="schematic-root">
        <span>hemant-samwat/</span>
        <strong>Monorepo root / pnpm workspace / turbo orchestration target</strong>
      </div>

      <div className="schematic-columns">
        {ecosystemColumns.map((column) => (
          <article className="schematic-column" key={column.title}>
            <h3>{column.title}</h3>
            <p>{column.subtitle}</p>
            <ul>
              {column.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="schematic-flow">
        <section className="schematic-layer">
          <h3>Local Isolation & Offline Infrastructure</h3>
          <p>All current proofs are loopback/local-first. Real model inference remains staged until weights and execution adapters are connected.</p>
          <div className="offline-core-grid">
            {offlineCores.map(([label, stack, state]) => (
              <div className="offline-core" key={label}>
                <span>{label}</span>
                <strong>{stack}</strong>
                <em>{state}</em>
              </div>
            ))}
          </div>
        </section>

        <section className="schematic-layer viewport-layer">
          <h3>SovereignDashboard Viewport Engine</h3>
          <div className="quadrant-grid">
            {viewportQuadrants.map(([title, detail]) => (
              <div className="quadrant" key={title}>
                <strong>{title}</strong>
                <span>{detail}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="schematic-layer archive-layer">
          <h3>Production Archive Pipeline</h3>
          <ol>
            {archiveSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      </div>
    </section>
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
