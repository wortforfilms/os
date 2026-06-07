import { useMemo, useState } from "react";
import {
  domainSearchStatus,
  getGovernedDomainRegistry,
  hasDomainBlocker,
  isDomainRouteImplemented,
  summarizeDomainRegistry,
  type DomainRegistryEntry,
} from "./index";

export type DomainRegistryView = "registry" | "status" | "runtime";

export function viewForDomainRoute(route: string): DomainRegistryView {
  if (route === "/domains/status") {
    return "status";
  }
  if (route === "/domains/runtime") {
    return "runtime";
  }
  return "registry";
}

export function DomainRegistryPage({
  route,
  navigate,
}: {
  route: string;
  navigate: (route: string) => void;
}) {
  const registry = getGovernedDomainRegistry();
  const summary = summarizeDomainRegistry(registry.domains);
  const view = viewForDomainRoute(route);
  const [query, setQuery] = useState("");
  const filteredDomains = useMemo(() => filterDomains(registry.domains, query, view), [registry.domains, query, view]);
  const selectedBlockers = filteredDomains.filter((domain) => hasDomainBlocker(domain));

  return (
    <section className="search-page" aria-label="Governed domains registry">
      <header className="auth-card">
        <p className="dashboard-kicker">Governed Domains</p>
        <h2>{viewTitle(view)}</h2>
        <p>
          Final status <strong>{registry.finalStatus}</strong>. Production ready <strong>{String(registry.productionReady)}</strong>. PHKD{" "}
          <strong>{registry.phkdVerdict}</strong>.
        </p>
      </header>

      <div className="admin-stat-grid" aria-label="Domain registry summary">
        <Stat label="Domains" value={summary.total} />
        <Stat label="DNS Unknown" value={summary.dnsUnknown} />
        <Stat label="Blocked Runtime" value={summary.runtimeBlocked + summary.missingRoutes} />
      </div>

      <div className="search-controls auth-card">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search domain, runtime, surface, evidence..." />
        <select value={view} onChange={(event) => navigate(routeForView(event.target.value as DomainRegistryView))}>
          <option value="registry">registry</option>
          <option value="status">status</option>
          <option value="runtime">runtime</option>
        </select>
        <select value={registry.finalStatus} disabled>
          <option>{registry.finalStatus}</option>
        </select>
      </div>

      {filteredDomains.length === 0 ? (
        <div className="auth-card empty-search" role="status">
          <strong>EMPTY</strong>
          <p>No governed domains matched the current query.</p>
        </div>
      ) : null}

      <section className="auth-card" aria-label="Domain registry table">
        <table className="auth-table">
          <thead>
            <tr>
              <th>Domain</th>
              <th>Surface</th>
              <th>Route</th>
              <th>Runtime</th>
              <th>DNS</th>
              <th>Runtime State</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {filteredDomains.map((domain) => (
              <tr key={domain.id}>
                <td>{domain.domain}</td>
                <td>{domain.surface}</td>
                <td>
                  <button disabled={!isDomainRouteImplemented(domain.route)} onClick={() => navigate(domain.route)}>
                    {isDomainRouteImplemented(domain.route) ? domain.route : "ROUTE BLOCKED"}
                  </button>
                </td>
                <td>{domain.runtime}</td>
                <td>
                  <Badge value={domain.dnsState} />
                </td>
                <td>
                  <Badge value={domain.runtimeState} />
                </td>
                <td>{domain.evidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="search-results" aria-label="Domain blockers and evidence">
        <article className="search-result-card blocked">
          <header>
            <span>Evidence</span>
            <strong>{registry.phkdVerdict}</strong>
          </header>
          <h3>Domain registry evidence</h3>
          <p>{registry.evidence}</p>
          <div className="search-tags">
            <em>release/evidence/domain-registry.json</em>
            <em>docs/DOMAINS.md</em>
          </div>
        </article>
        {selectedBlockers.map((domain) => (
          <article className="search-result-card blocked" key={`blocker:${domain.id}`}>
            <header>
              <span>{domain.domain}</span>
              <strong>{domainSearchStatus(domain)}</strong>
            </header>
            <h3>{domain.surface}</h3>
            <p>{domain.blocker}</p>
            <div className="search-tags">
              <em>dns:{domain.dnsState}</em>
              <em>runtime:{domain.runtimeState}</em>
              <em>{isDomainRouteImplemented(domain.route) ? domain.route : "missing-route"}</em>
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}

function filterDomains(domains: DomainRegistryEntry[], query: string, view: DomainRegistryView): DomainRegistryEntry[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return domains.filter((domain) => {
    if (view === "status" && !hasDomainBlocker(domain)) {
      return false;
    }
    if (view === "runtime" && domain.runtimeState === "UNKNOWN") {
      return true;
    }
    if (words.length === 0) {
      return true;
    }
    const haystack = [domain.domain, domain.surface, domain.route, domain.runtime, domain.dnsState, domain.runtimeState, domain.evidence, domain.blocker]
      .join(" ")
      .toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

function Badge({ value }: { value: string }) {
  return <span className={`status-pill ${value === "BLOCKED" ? "critical" : value === "UNKNOWN" ? "warning" : ""}`}>{value}</span>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="admin-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function viewTitle(view: DomainRegistryView): string {
  if (view === "status") {
    return "DNS and blocker status.";
  }
  if (view === "runtime") {
    return "Domain to runtime mapping.";
  }
  return "Governed domain registry.";
}

function routeForView(view: DomainRegistryView): string {
  if (view === "status") {
    return "/domains/status";
  }
  if (view === "runtime") {
    return "/domains/runtime";
  }
  return "/domains";
}
