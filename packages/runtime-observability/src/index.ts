/*
 * @maataa/runtime-observability
 * Minimal but REAL in-memory observability fabric.
 * Spec: doc/RUNTIME_FEDERATION_2026-05-28.md §4.1
 *
 * Honest scope: runtimes self-report status via report(); topology is built from
 * link(); lineage from emit(). collect/getTopology/getLineage return real data.
 * In-memory only, not production-GO (__meta.governedProductionGo=false).
 */
import RuntimePersistence from "../../runtime-persistence/src/index.ts";

const RUNTIME = "runtime-observability";
const VERSION = "0.1.0-alpha.1";

export type Ok<T>  = { isOk: true;  data: T;    error: null };
export type Err    = { isOk: false; data: null; error: { code: string; detail: string } };
export type Result<T> = Ok<T> | Err;
const ok = <T>(data: T): Ok<T> => ({ isOk: true, data, error: null });
const errR = (code: string, detail: string): Err => ({ isOk: false, data: null, error: { code, detail } });

export type HealthTarget      = { runtime: string; endpoint?: string };
export type AggregatedHealth  = { ts: number; sources: Array<{ runtime: string; status: string }> };
export type TopologyGraph     = { nodes: Array<{ id: string; runtime: string }>; edges: Array<{ from: string; to: string; kind: string }> };
export type LineageRecord     = { eventId: string; chain: Array<{ runtime: string; ts: number; ref: string }> };

const reported = new Map<string, string>();              // runtime -> status
const topoEdges: Array<{ from: string; to: string; kind: string }> = [];
const lineage = new Map<string, LineageRecord>();
let lastEventTs: number | null = null;
const touch = () => { lastEventTs = Date.now(); };

// SQLite persistence layer
const persistence = new RuntimePersistence(RUNTIME);

// Restore state from persistence
function restoreFromPersistence(): void {
  const reportedStates = persistence.load("reported");
  if (reportedStates.ok && reportedStates.value && typeof reportedStates.value === "object") {
    for (const [key, value] of Object.entries(reportedStates.value)) {
      reported.set(key, value as string);
    }
  }
  const storedEdges = persistence.load("topoEdges");
  if (storedEdges.ok && Array.isArray(storedEdges.value)) {
    topoEdges.push(...(storedEdges.value as Array<{ from: string; to: string; kind: string }>));
  }
  const storedLineage = persistence.load("lineage");
  if (storedLineage.ok && storedLineage.value && typeof storedLineage.value === "object") {
    for (const [key, value] of Object.entries(storedLineage.value)) {
      lineage.set(key, value as LineageRecord);
    }
  }
}

// Persist state
function persistState(): void {
  persistence.persist("reported", Object.fromEntries(reported));
  persistence.persist("topoEdges", topoEdges);
  persistence.persist("lineage", Object.fromEntries(lineage));
}

// Initialize on module load
restoreFromPersistence();

export function reset(): void { reported.clear(); topoEdges.length = 0; lineage.clear(); lastEventTs = null; persistence.clear(); }

/** A runtime self-reports its current status. */
export function report(runtime: string, status: string): Result<true> {
  if (!runtime) return errR("invalid_report", "report: runtime required");
  reported.set(runtime, status);
  touch();
  persistState(); // Persist after change
  return ok(true);
}

/** Declare a dependency/data edge between two runtimes. */
export function link(from: string, to: string, kind: string): Result<true> {
  if (!from || !to) return errR("invalid_link", "link: from and to required");
  const edge = { from, to, kind: kind || "depends-on" };
  if (!topoEdges.some((e) => e.from === edge.from && e.to === edge.to && e.kind === edge.kind)) {
    topoEdges.push(edge);
  }
  touch();
  persistState(); // Persist after change
  return ok(true);
}

/** Append a lineage hop for an event. */
export function emit(eventId: string, runtime: string, ref: string): Result<true> {
  if (!eventId || !runtime) return errR("invalid_event", "emit: eventId and runtime required");
  const rec = lineage.get(eventId) ?? { eventId, chain: [] };
  rec.chain.push({ runtime, ts: Date.now(), ref });
  lineage.set(eventId, rec);
  touch();
  persistState(); // Persist after change
  return ok(true);
}

export function collect(targets: HealthTarget[]): Result<AggregatedHealth> {
  if (!Array.isArray(targets)) return errR("invalid_targets", "collect: targets must be an array");
  const sources = targets.map((t) => ({ runtime: t.runtime, status: reported.get(t.runtime) ?? "unknown" }));
  return ok({ ts: Date.now(), sources });
}

export function getTopology(): Result<TopologyGraph> {
  const ids = new Set<string>();
  for (const e of topoEdges) { ids.add(e.from); ids.add(e.to); }
  for (const r of reported.keys()) ids.add(r);
  return ok({ nodes: [...ids].map((id) => ({ id, runtime: id })), edges: [...topoEdges] });
}

export function getLineage(eventId: string): Result<LineageRecord> {
  const rec = lineage.get(eventId);
  if (!rec) return errR("not_found", `getLineage: no lineage for '${eventId}'`);
  return ok(rec);
}

export type HealthReport = {
  runtime: string; version: string; status: "scaffold" | "degraded" | "ready"; initialized: boolean; capabilities: string[];
  evidence: {
    pendingOps: number; lastEventTs: number | null; reportedRuntimes: number; topologyEdges: number; lineageEvents: number;
    persistence: ReturnType<RuntimePersistence["health"]>;
    notes: string[]
  };
  __meta: { reconstructed: boolean; governedProductionGo: false; scope: "in-memory" };
};

export function health(): HealthReport {
  return {
    runtime: RUNTIME, version: VERSION, status: "ready", initialized: true,
    capabilities: ["report", "link", "emit", "collect", "getTopology", "getLineage"],
    evidence: {
      pendingOps: 0, lastEventTs,
      reportedRuntimes: reported.size, topologyEdges: topoEdges.length, lineageEvents: lineage.size,
      persistence: persistence.health(),
      notes: [
        "in-memory fabric: real report/link/emit + collect/getTopology/getLineage",
        "state persisted to SQLite via runtime-persistence",
        "NOT production-GO (governedProductionGo=false)",
      ],
    },
    __meta: { reconstructed: false, governedProductionGo: false, scope: "in-memory" },
  };
}
