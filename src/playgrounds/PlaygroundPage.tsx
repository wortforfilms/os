import { useMemo, useState } from "react";
import {
  PLAYGROUND_FINAL_STATUS,
  PLAYGROUND_PRODUCTION_STATUS,
  getPlaygroundRoute,
  playgroundRoutes,
  type PlaygroundRoute,
  type PlaygroundRouteId,
  type PlaygroundSection,
  type PlaygroundStatus,
} from "./data";

const filters = ["all", "Maataa UI", "ThemeLab"] as const;

const tokenSwatches = [
  { name: "runtime-bg", value: "#081018", role: "Shell background" },
  { name: "signal-cyan", value: "#66fcf1", role: "Preview verified signal" },
  { name: "dharma-gold", value: "#d6a55c", role: "Review emphasis" },
  { name: "blocked-red", value: "#ff8f8f", role: "Blocked controls" },
  { name: "panel-line", value: "#2a3c42", role: "Review borders" },
];

export function PlaygroundPage({ route, navigate }: { route: PlaygroundRouteId; navigate: (route: string) => void }) {
  const selected = getPlaygroundRoute(route) ?? playgroundRoutes[0];
  const [query, setQuery] = useState("");
  const [familyFilter, setFamilyFilter] = useState<(typeof filters)[number]>("all");

  const visibleRoutes = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return playgroundRoutes.filter((item) => {
      if (familyFilter !== "all" && item.family !== familyFilter) {
        return false;
      }
      if (!words.length) {
        return true;
      }
      const text = [item.path, item.title, item.family, item.summary, item.status, ...item.sections.map((section) => `${section.label} ${section.status} ${section.blocker ?? ""}`)]
        .join(" ")
        .toLowerCase();
      return words.every((word) => text.includes(word));
    });
  }, [familyFilter, query]);

  return (
    <section className="playground-shell" aria-label="PHKD-safe Maataa UI and ThemeLab playground">
      <header className="playground-hero">
        <div>
          <p className="dashboard-kicker">Review Surface</p>
          <h1>{selected.title}</h1>
          <p>{selected.summary}</p>
        </div>
        <div className="playground-verdict" aria-label="Production boundary">
          <span>Runtime</span>
          <strong>{PLAYGROUND_FINAL_STATUS}</strong>
          <span>Production</span>
          <strong>{PLAYGROUND_PRODUCTION_STATUS}</strong>
        </div>
      </header>

      <div className="playground-controls" aria-label="Playground filters">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search review surfaces, blockers, tokens..." />
        <select value={familyFilter} onChange={(event) => setFamilyFilter(event.target.value as (typeof filters)[number])}>
          {filters.map((filter) => (
            <option key={filter} value={filter}>
              {filter === "all" ? "All surfaces" : filter}
            </option>
          ))}
        </select>
      </div>

      <div className="playground-route-tabs" aria-label="Playground routes">
        {playgroundRoutes.map((item) => (
          <button className={item.path === selected.path ? "active" : ""} key={item.path} onClick={() => navigate(item.path)}>
            {item.title}
          </button>
        ))}
      </div>

      <section className="playground-overview" aria-label="Selected route details">
        <BoundaryCard route={selected} />
        <BlockerPanel route={selected} />
        <TokenPanel />
      </section>

      <section className="review-grid" aria-label="Visible review routes">
        {visibleRoutes.length ? (
          visibleRoutes.map((item) => <RouteCard key={item.path} route={item} selected={item.path === selected.path} navigate={navigate} />)
        ) : (
          <article className="review-card empty">
            <StatusBadge status="UNKNOWN" />
            <h2>No matching review surfaces.</h2>
            <p>Filters only search local playground metadata. No network or production database query is performed.</p>
          </article>
        )}
      </section>
    </section>
  );
}

function BoundaryCard({ route }: { route: PlaygroundRoute }) {
  return (
    <article className="review-card boundary-card">
      <header>
        <StatusBadge status={route.status} />
        <span>{route.family}</span>
      </header>
      <h2>Local Review Contract</h2>
      <dl className="review-dl">
        <div>
          <dt>Data</dt>
          <dd>{route.dataMode}</dd>
        </div>
        <div>
          <dt>Payments</dt>
          <dd>{route.paymentMode}</dd>
        </div>
        <div>
          <dt>Runtime Promotion</dt>
          <dd>{route.runtimePromotion ? "ENABLED" : "DISABLED"}</dd>
        </div>
        <div>
          <dt>Evidence</dt>
          <dd>{route.evidence}</dd>
        </div>
      </dl>
    </article>
  );
}

function BlockerPanel({ route }: { route: PlaygroundRoute }) {
  const blockers = route.sections.filter((section) => section.status === "BLOCKED" || section.status === "UNKNOWN" || section.blocker);
  return (
    <article className="review-card blocker-panel">
      <header>
        <StatusBadge status={blockers.length ? "BLOCKED" : "PREVIEW_VERIFIED"} />
        <span>PHKD</span>
      </header>
      <h2>Blocked Reason Panel</h2>
      {blockers.length ? (
        <ul className="blocker-list">
          {blockers.map((section) => (
            <li key={section.id}>
              <strong>{section.label}</strong>
              <span>{section.blocker ?? "Requires additional measurement evidence."}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>No blocker inside this local review surface. Global production gate remains blocked.</p>
      )}
    </article>
  );
}

function TokenPanel() {
  return (
    <article className="review-card token-panel">
      <header>
        <StatusBadge status="PREVIEW_VERIFIED" />
        <span>Tokens</span>
      </header>
      <h2>Token Swatches</h2>
      <div className="token-swatches">
        {tokenSwatches.map((token) => (
          <div className="token-swatch" key={token.name}>
            <span style={{ backgroundColor: token.value }} aria-hidden="true" />
            <strong>{token.name}</strong>
            <small>{token.role}</small>
          </div>
        ))}
      </div>
    </article>
  );
}

function RouteCard({ route, selected, navigate }: { route: PlaygroundRoute; selected: boolean; navigate: (route: string) => void }) {
  return (
    <article className={`review-card route-card ${selected ? "selected" : ""}`}>
      <header>
        <StatusBadge status={route.status} />
        <span>{route.path}</span>
      </header>
      <h2>{route.title}</h2>
      <p>{route.summary}</p>
      <div className="section-list">
        {route.sections.map((section) => (
          <SectionLine key={section.id} section={section} />
        ))}
      </div>
      <button onClick={() => navigate(route.path)}>Open Review Route</button>
    </article>
  );
}

function SectionLine({ section }: { section: PlaygroundSection }) {
  return (
    <div className="section-line">
      <span>{section.label}</span>
      <StatusBadge status={section.status} />
    </div>
  );
}

function StatusBadge({ status }: { status: PlaygroundStatus }) {
  return <strong className={`playground-status ${status.toLowerCase().replace(/_/g, "-")}`}>{status}</strong>;
}
