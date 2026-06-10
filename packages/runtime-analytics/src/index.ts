/*
 * @maataa/runtime-analytics
 * Admin analytics PERSISTENCE runtime.
 *
 * PHKD honesty:
 *   - Records only REAL, observed events (record() is the sole source of data).
 *   - aggregate() is a deterministic fold over exactly those recorded events —
 *     it NEVER invents counts, rates, or "live" figures. The `observedNotLive`
 *     marker makes that explicit to every consumer/UI.
 *   - Fail-closed: malformed events are rejected, not silently coerced.
 *   - Observable: health() exposes real totals + governedProductionGo=false.
 *   - Persistence: @maataa/runtime-persistence (shared SQLite), the established
 *     storage runtime other runtimes already consume.
 */
import RuntimePersistence from "../../runtime-persistence/src/index.ts";

export interface AnalyticsEvent {
  type: string;
  actor?: string;
  subject?: string;
  props?: Record<string, string | number | boolean>;
  ts: number;
}

export interface AnalyticsAggregate {
  runtime: "runtime-analytics";
  totalEvents: number;
  byType: Record<string, number>;
  byActor: Record<string, number>;
  distinctActors: number;
  firstTs: number | null;
  lastTs: number | null;
  /** Honesty marker: these are observed/recorded counts, NOT live/marketing metrics. */
  observedNotLive: true;
}

export interface AnalyticsHealth {
  runtime: "runtime-analytics";
  status: "active";
  totalEvents: number;
  persistence: string;
  governedProductionGo: false;
  note: string;
}

const RUNTIME = "runtime-analytics";
const EVENTS_KEY = "events";

const sortRecord = (rec: Record<string, number>): Record<string, number> =>
  Object.fromEntries(Object.keys(rec).sort().map((k) => [k, rec[k]]));

export class AnalyticsRuntime {
  private persistence: RuntimePersistence;

  constructor(dbPath?: string) {
    this.persistence = new RuntimePersistence(RUNTIME, dbPath);
  }

  private loadEvents(): AnalyticsEvent[] {
    const r = this.persistence.load(EVENTS_KEY);
    return r.ok && Array.isArray(r.value) ? (r.value as AnalyticsEvent[]) : [];
  }

  /** Record a real observed event. Fail-closed on missing/empty type. */
  record(event: { type: string; actor?: string; subject?: string; props?: AnalyticsEvent["props"]; ts?: number }): AnalyticsEvent {
    if (!event || typeof event.type !== "string" || event.type.trim() === "") {
      throw new Error("runtime-analytics.record: a non-empty event.type is required (fail closed)");
    }
    const stored: AnalyticsEvent = {
      type: event.type,
      actor: event.actor,
      subject: event.subject,
      props: event.props,
      ts: typeof event.ts === "number" ? event.ts : Date.now(),
    };
    const events = this.loadEvents();
    events.push(stored);
    const result = this.persistence.persist(EVENTS_KEY, events);
    if (!result.ok) throw new Error("runtime-analytics.record: persistence failed (fail closed)");
    return stored;
  }

  /** Most recent events first (real records only). */
  recent(n = 20): AnalyticsEvent[] {
    const events = this.loadEvents();
    return events.slice(-Math.max(0, n)).reverse();
  }

  /** Deterministic aggregate over exactly the recorded events. */
  aggregate(): AnalyticsAggregate {
    const events = this.loadEvents();
    const byType: Record<string, number> = {};
    const byActor: Record<string, number> = {};
    let firstTs: number | null = null;
    let lastTs: number | null = null;
    for (const e of events) {
      byType[e.type] = (byType[e.type] || 0) + 1;
      if (e.actor) byActor[e.actor] = (byActor[e.actor] || 0) + 1;
      if (firstTs === null || e.ts < firstTs) firstTs = e.ts;
      if (lastTs === null || e.ts > lastTs) lastTs = e.ts;
    }
    return {
      runtime: RUNTIME,
      totalEvents: events.length,
      byType: sortRecord(byType),
      byActor: sortRecord(byActor),
      distinctActors: Object.keys(byActor).length,
      firstTs,
      lastTs,
      observedNotLive: true,
    };
  }

  health(): AnalyticsHealth {
    return {
      runtime: RUNTIME,
      status: "active",
      totalEvents: this.loadEvents().length,
      persistence: "@maataa/runtime-persistence (SQLite)",
      governedProductionGo: false,
      note: "aggregates only real recorded events; no live/marketing metrics",
    };
  }

  /** Clear recorded events (rollback/testing). */
  reset(): boolean {
    return this.persistence.delete(EVENTS_KEY);
  }
}

export default AnalyticsRuntime;
