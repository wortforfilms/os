/*
 * @maataa/runtime-observability
 * Scaffold-only. Every method returns fail-closed not_implemented results.
 * Spec: doc/RUNTIME_FEDERATION_2026-05-28.md §4.1
 */

const RUNTIME = "runtime-observability";
const VERSION = "0.1.0-alpha.1";

// ---- Result envelope (duplicated locally per package) ---------------------
export type Ok<T>  = { isOk: true;  data: T;    error: null };
export type Err    = { isOk: false; data: null; error: { code: string; detail: string } };
export type Result<T> = Ok<T> | Err;

const notImplemented = <T>(method: string): Result<T> => ({
  isOk: false,
  data: null,
  error: { code: "not_implemented", detail: `${RUNTIME}.${method}: scaffold-only` }
});

// ---- Contract types (proposed; opaque at scaffold) ------------------------
export type HealthTarget      = { runtime: string; endpoint?: string };
export type AggregatedHealth  = { ts: number; sources: Array<{ runtime: string; status: string }> };
export type TopologyGraph     = { nodes: Array<{ id: string; runtime: string }>; edges: Array<{ from: string; to: string; kind: string }> };
export type LineageRecord     = { eventId: string; chain: Array<{ runtime: string; ts: number; ref: string }> };

// ---- Facade (fail-closed at scaffold) -------------------------------------
export async function collect(_targets: HealthTarget[]): Promise<Result<AggregatedHealth>> {
  return notImplemented("collect");
}

export async function getTopology(): Promise<Result<TopologyGraph>> {
  return notImplemented("getTopology");
}

export async function getLineage(_eventId: string): Promise<Result<LineageRecord>> {
  return notImplemented("getLineage");
}

// ---- Observable surface ---------------------------------------------------
export type HealthReport = {
  runtime: string;
  version: string;
  status: "scaffold" | "degraded" | "ready";
  initialized: boolean;
  capabilities: string[];
  evidence: { pendingOps: number; lastEventTs: number | null; notes: string[] };
  __meta: { reconstructed: boolean; governedProductionGo: false; scope: "unresolved" };
};

export function health(): HealthReport {
  return {
    runtime: RUNTIME,
    version: VERSION,
    status: "scaffold",
    initialized: false,
    capabilities: [],
    evidence: {
      pendingOps: 0,
      lastEventTs: null,
      notes: [
        "scaffold-only: no collection performed",
        "scope: unresolved (runtime-hkd-registry not yet present)"
      ]
    },
    __meta: {
      reconstructed: false,
      governedProductionGo: false,
      scope: "unresolved"
    }
  };
}
