import type { CSSProperties, ReactNode } from "react";

type WidgetStatus = "Active" | "Staged" | "Nominal" | "Armed" | "Certified" | "Blocked" | "Signed" | "Verified";

type WidgetItem = {
  label: string;
  status: WidgetStatus | string;
};

const colors = {
  surface: "#0b1224",
  page: "#050816",
  border: "#1f2833",
  text: "#c5c6c7",
  cyan: "#00c2ff",
  teal: "#45a29e",
  gold: "#d6a55c",
  red: "#ef4444",
  redBorder: "#7f1d1d",
  white: "#ffffff",
};

const headingStyle: CSSProperties = {
  margin: 0,
  paddingBottom: 6,
  borderBottom: `1px solid ${colors.border}`,
  fontSize: 12,
  fontWeight: 800,
  color: colors.cyan,
  letterSpacing: 0,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
  marginTop: 10,
};

function MiniCard({ label, status }: WidgetItem) {
  return (
    <div
      style={{
        minHeight: 52,
        display: "grid",
        alignContent: "center",
        gap: 4,
        padding: 8,
        border: `1px solid ${colors.border}`,
        borderRadius: 6,
        background: colors.page,
        textAlign: "center",
      }}
    >
      <strong style={{ color: colors.white, fontSize: 10, lineHeight: 1.25 }}>{label}</strong>
      <span style={{ color: colors.teal, fontSize: 9, lineHeight: 1.2 }}>{status}</span>
    </div>
  );
}

function WidgetFrame({ title, index, accent = colors.cyan, children }: { title: string; index: string; accent?: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <h3 style={{ ...headingStyle, color: accent }}>
        {index} {title}
      </h3>
      {children}
    </div>
  );
}

function StatusGrid({ items }: { items: readonly WidgetItem[] }) {
  return (
    <div style={gridStyle}>
      {items.map((item) => (
        <MiniCard key={`${item.label}:${item.status}`} {...item} />
      ))}
    </div>
  );
}

export function GenesisModule() {
  return (
    <WidgetFrame index="01" title="GENESIS AI">
      <StatusGrid
        items={[
          { label: "Mandi", status: "Commerce" },
          { label: "ALLB Shop", status: "Assets" },
          { label: "Vidhaan", status: "Knowledge" },
          { label: "AAI", status: "Intelligence" },
          { label: "KAA", status: "Language" },
          { label: "CIC", status: "Communication" },
        ]}
      />
    </WidgetFrame>
  );
}

export function OrchestrationLayer() {
  return (
    <WidgetFrame index="02" title="ORCHESTRATION">
      <StatusGrid
        items={[
          { label: "Scheduler", status: "Deterministic" },
          { label: "Capsules", status: "Mounted" },
          { label: "Recovery", status: "Armed" },
          { label: "HSTS", status: "Verified" },
          { label: "MOSF", status: "Signed" },
          { label: "Boot", status: "Nominal" },
        ]}
      />
    </WidgetFrame>
  );
}

export function MonorepoSovereignty() {
  return (
    <WidgetFrame index="03" title="MONOREPO SOVEREIGNTY">
      <StatusGrid
        items={[
          { label: "Root Crate", status: "Active" },
          { label: "Tauri", status: "Running" },
          { label: "Node Bridge", status: "Local" },
          { label: "ML Engine", status: "Offline" },
          { label: "Golden Image", status: "Signed" },
          { label: "Assets HTML", status: "Isolated" },
        ]}
      />
    </WidgetFrame>
  );
}

export function MaataaUiPanel() {
  return (
    <WidgetFrame index="04" title="MAATAA-UI">
      <StatusGrid
        items={[
          { label: "Sovereign Header", status: "Active" },
          { label: "Mobile Shell", status: "Staged" },
          { label: "Runtime Status", status: "Nominal" },
          { label: "Command Overlay", status: "Armed" },
          { label: "Topology Graph", status: "Active" },
          { label: "Observatory Panels", status: "Certified" },
        ]}
      />
    </WidgetFrame>
  );
}

export function CompletionRuntime() {
  return (
    <WidgetFrame index="05" title="COMPLETION RUNTIME">
      <StatusGrid
        items={[
          { label: "Go/No-Go", status: "Enforced" },
          { label: "Evidence", status: "Verified" },
          { label: "Rollback", status: "Signed" },
          { label: "Topology", status: "Captured" },
          { label: "Replay", status: "Verified" },
          { label: "Manifests", status: "Canonical" },
        ]}
      />
    </WidgetFrame>
  );
}

export function RuntimeObservatory() {
  return (
    <WidgetFrame index="06" title="RUNTIME OBSERVATORY">
      <StatusGrid
        items={[
          { label: "Evidence Graph", status: "Active" },
          { label: "Promotion Gate", status: "Armed" },
          { label: "Manifest Panel", status: "Verified" },
          { label: "Telemetry", status: "Streaming" },
          { label: "Validation", status: "Signed" },
          { label: "Drift", status: "Watched" },
        ]}
      />
    </WidgetFrame>
  );
}

export function OfflineSovereignty() {
  return (
    <WidgetFrame index="07" title="OFFLINE SOVEREIGNTY">
      <StatusGrid
        items={[
          { label: "Cloud", status: "None" },
          { label: "Telemetry", status: "Local" },
          { label: "Receipts", status: "File" },
        ]}
      />
    </WidgetFrame>
  );
}

export function AyodhyaStudio() {
  return (
    <WidgetFrame index="08" title="AYODHYA STUDIO" accent={colors.gold}>
      <StatusGrid
        items={[
          { label: "Launch", status: "Staged" },
          { label: "Events", status: "Queued" },
          { label: "Ops", status: "Nominal" },
        ]}
      />
    </WidgetFrame>
  );
}

export function RadioRuntime() {
  const durationSeconds = 46;
  const elapsedSeconds = 45;
  const progress = Math.max(0, Math.min(100, (elapsedSeconds / durationSeconds) * 100));

  return (
    <div style={{ display: "grid", minHeight: "100%", alignContent: "space-between", gap: 10 }}>
      <WidgetFrame index="09" title="RADIO RUNTIME" accent={colors.gold}>
        <span style={{ display: "block", color: colors.teal, fontSize: 9 }}>STATION: RADIO.VAIGYAANIQ</span>
      </WidgetFrame>
      <div style={{ border: `1px solid ${colors.border}`, borderRadius: 6, background: colors.page, padding: 12, textAlign: "center" }}>
        <div style={{ color: "#9ca3af", fontSize: 10 }}>Now Playing</div>
        <strong style={{ display: "block", marginTop: 4, color: colors.white, fontSize: 12 }}>Sacred Morning</strong>
        <span style={{ color: colors.cyan, fontSize: 9 }}>A Devotional Journey</span>
        <div style={{ height: 4, borderRadius: 999, background: "#1f2937", marginTop: 12, overflow: "hidden" }}>
          <div style={{ width: `${progress}%`, height: "100%", background: colors.gold }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280", fontSize: 8, marginTop: 4 }}>
          <span>0:45</span>
          <span>0:46</span>
        </div>
      </div>
      <button
        type="button"
        style={{
          width: "100%",
          padding: "6px 8px",
          borderRadius: 6,
          border: "1px solid #b91c1c",
          background: "#450a0a",
          color: "#fecaca",
          fontFamily: "inherit",
          fontSize: 10,
          fontWeight: 800,
          textTransform: "uppercase",
        }}
      >
        Unlock Full Track INR 10
      </button>
    </div>
  );
}

export function CommunicationCore() {
  return (
    <WidgetFrame index="10" title="COMMUNICATION CORE">
      <StatusGrid
        items={[
          { label: "Newsletters", status: "Queue" },
          { label: "Inbox", status: "Adapter" },
          { label: "Alerts", status: "SSE" },
          { label: "Retry", status: "Bounded" },
          { label: "IPC", status: "Local" },
          { label: "Comm Ring", status: "Signed" },
        ]}
      />
    </WidgetFrame>
  );
}

export function LipiCivilization() {
  return (
    <WidgetFrame index="11" title="LIPI CIVILIZATION">
      <StatusGrid
        items={[
          { label: "Brahmi", status: "Ancient" },
          { label: "Gurmukhi", status: "Regional" },
          { label: "Sharda", status: "Heritage" },
          { label: "Shahmukhi", status: "Perso-Arabic" },
          { label: "Landa", status: "Linguistic" },
          { label: "Knowledge Graph", status: "Hydrated" },
        ]}
      />
    </WidgetFrame>
  );
}

export function ChakraConsciousness() {
  return (
    <WidgetFrame index="12" title="CHAKRA CONSCIOUSNESS">
      <StatusGrid
        items={[
          { label: "Aura", status: "Active" },
          { label: "Registry", status: "Typed" },
          { label: "Runtime", status: "Nominal" },
        ]}
      />
    </WidgetFrame>
  );
}

export function BrahminiChain() {
  return (
    <WidgetFrame index="13" title="BRAHMINI CHAIN">
      <StatusGrid
        items={[
          { label: "ERC-20", status: "Ledger" },
          { label: "ERC-1155", status: "Ledger" },
          { label: "Soulbound", status: "Gated" },
        ]}
      />
    </WidgetFrame>
  );
}

export function TlpEvolution() {
  return (
    <WidgetFrame index="14" title="TLP EVOLUTION">
      <StatusGrid
        items={[
          { label: "Schedule", status: "Active" },
          { label: "Accounting", status: "Auditable" },
          { label: "Vendors", status: "Registered" },
        ]}
      />
    </WidgetFrame>
  );
}

export function ScientificGovernance() {
  const safetyChecks = [
    "Astronomy Validation",
    "Ephemeris Evidence",
    "DE440 Verification",
    "Gaia Validation",
    "Panchanga Accuracy",
    "Transport Authority",
    "Telemetry Provenance",
  ];

  return (
    <div style={{ display: "grid", minHeight: "100%", alignContent: "space-between", gap: 16, overflow: "hidden" }}>
      <WidgetFrame index="15" title="SCIENTIFIC GOVERNANCE" accent={colors.red}>
        <ul style={{ display: "grid", gap: 5, margin: 0, padding: 0, listStyle: "none", color: "#9ca3af", fontSize: 10 }}>
          {safetyChecks.map((check) => (
            <li key={check} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span aria-hidden="true" style={{ color: "#b91c1c" }}>
                !
              </span>
              {check}
            </li>
          ))}
        </ul>
      </WidgetFrame>
      <div
        style={{
          border: "2px solid #dc2626",
          borderRadius: 8,
          background: "rgba(127, 29, 29, 0.45)",
          padding: 10,
          textAlign: "center",
          transform: "rotate(-2deg)",
          fontWeight: 900,
        }}
      >
        <div style={{ color: colors.red, fontSize: 14, letterSpacing: 1 }}>CONTROLLED NO-GO</div>
        <div style={{ color: colors.white, fontSize: 8, marginTop: 2 }}>Beautiful Architecture != Verified Reality</div>
      </div>
    </div>
  );
}

export function RemainingGaps() {
  return (
    <WidgetFrame index="17" title="REMAINING GAPS" accent={colors.red}>
      <StatusGrid
        items={[
          { label: "Evidence Gates", status: "Partial" },
          { label: "Human Drills", status: "Early" },
          { label: "Observability Scale", status: "Partial" },
          { label: "Scientific Proof", status: "Blocked" },
          { label: "Transport Authority", status: "Early" },
          { label: "Offline Audit", status: "Nominal" },
        ]}
      />
    </WidgetFrame>
  );
}
