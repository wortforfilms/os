// Read-only admin analytics surface.
//
// PHKD: a thin UX shell. It renders ONLY the real aggregate it is given (produced
// by @maataa/runtime-analytics over recorded events) and never computes or
// invents figures. It is intentionally decoupled from the runtime — it defines
// its own structural prop type so the browser bundle pulls in no Node/SQLite
// code. Every figure is labelled as observed/recorded, not live or projected.

export interface AdminAnalyticsAggregate {
  runtime: string;
  totalEvents: number;
  byType: Record<string, number>;
  byActor: Record<string, number>;
  distinctActors: number;
  firstTs: number | null;
  lastTs: number | null;
  /** Honesty marker from the runtime: observed counts, not live metrics. */
  observedNotLive: true;
}

export interface AdminAnalyticsRecentEvent {
  type: string;
  actor?: string;
  ts: number;
}

export interface AdminAnalyticsPanelProps {
  /** Real aggregate from @maataa/runtime-analytics. Defaults to the honest
   *  zero-state when no data source is wired (never fabricated figures). */
  aggregate?: AdminAnalyticsAggregate;
  recent?: readonly AdminAnalyticsRecentEvent[];
}

/** Honest empty aggregate — shown until a real analytics source is connected. */
export const EMPTY_ANALYTICS_AGGREGATE: AdminAnalyticsAggregate = {
  runtime: "runtime-analytics",
  totalEvents: 0,
  byType: {},
  byActor: {},
  distinctActors: 0,
  firstTs: null,
  lastTs: null,
  observedNotLive: true,
};

const fmtTs = (ts: number | null): string => (ts === null ? "—" : new Date(ts).toISOString());

const entries = (rec: Record<string, number>): Array<[string, number]> =>
  Object.entries(rec).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

export function AdminAnalyticsPanel({ aggregate = EMPTY_ANALYTICS_AGGREGATE, recent = [] }: AdminAnalyticsPanelProps) {
  const empty = aggregate.totalEvents === 0;
  return (
    <section data-testid="admin-analytics-panel" aria-label="Admin analytics">
      <header>
        <h3>Admin Analytics</h3>
        <p data-testid="analytics-honesty-note">
          Observed recorded events — not live, projected, or marketing metrics.
          Source: {aggregate.runtime} (persisted). governed-production: NO-GO.
        </p>
      </header>

      {empty ? (
        <p data-testid="analytics-empty">No events recorded yet.</p>
      ) : (
        <>
          <dl>
            <dt>Total events</dt>
            <dd data-testid="analytics-total">{aggregate.totalEvents}</dd>
            <dt>Distinct actors</dt>
            <dd>{aggregate.distinctActors}</dd>
            <dt>First / last recorded</dt>
            <dd>{fmtTs(aggregate.firstTs)} → {fmtTs(aggregate.lastTs)}</dd>
          </dl>

          <h4>By type</h4>
          <ul>
            {entries(aggregate.byType).map(([type, n]) => (
              <li key={type}>
                <span>{type}</span>: <strong>{n}</strong>
              </li>
            ))}
          </ul>

          <h4>By actor</h4>
          <ul>
            {entries(aggregate.byActor).map(([actor, n]) => (
              <li key={actor}>
                <span>{actor}</span>: <strong>{n}</strong>
              </li>
            ))}
          </ul>

          {recent.length > 0 && (
            <>
              <h4>Recent</h4>
              <ol>
                {recent.map((e, i) => (
                  <li key={`${e.ts}-${i}`}>
                    {fmtTs(e.ts)} — {e.type}{e.actor ? ` (${e.actor})` : ""}
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      )}
    </section>
  );
}

export default AdminAnalyticsPanel;
