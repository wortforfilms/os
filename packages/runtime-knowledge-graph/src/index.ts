/*
 * @maataa/runtime-knowledge-graph
 * Scaffold-only. Every method returns fail-closed not_implemented results.
 * Spec: doc/RUNTIME_FEDERATION_2026-05-28.md §4.2
 */

const RUNTIME = "runtime-knowledge-graph";
const VERSION = "0.1.0-alpha.1";

// ---- Result envelope ------------------------------------------------------
export type Ok<T>  = { isOk: true;  data: T;    error: null };
export type Err    = { isOk: false; data: null; error: { code: string; detail: string } };
export type Result<T> = Ok<T> | Err;

const notImplemented = <T>(method: string): Result<T> => ({
  isOk: false,
  data: null,
  error: { code: "not_implemented", detail: `${RUNTIME}.${method}: scaffold-only` }
});

// ---- Contract types -------------------------------------------------------
export type EntityTypeSpec = { name: string; schema: Record<string, string> };
export type EntityId    = string;
export type EdgeId      = string;
export type EvidenceRef = { source: "runtime-hkd-registry" | "runtime-validation"; id: string };
export type GraphPattern = { from?: EntityId; type?: string; to?: EntityId };
export type Match       = { from: EntityId; type: string; to: EntityId; evidenceRef: EvidenceRef | null };

// ---- Facade ---------------------------------------------------------------
export async function defineEntityType(_spec: EntityTypeSpec): Promise<Result<{ typeId: string }>> {
  return notImplemented("defineEntityType");
}

export async function addEntity(_typeId: string, _payload: unknown): Promise<Result<{ id: EntityId }>> {
  return notImplemented("addEntity");
}

export async function addRelation(
  _from: EntityId,
  _type: string,
  _to: EntityId,
  _evidenceRef?: EvidenceRef
): Promise<Result<{ edgeId: EdgeId }>> {
  return notImplemented("addRelation");
}

export async function query(_pattern: GraphPattern): Promise<Result<Match[]>> {
  return notImplemented("query");
}

// ---- Observable surface ---------------------------------------------------
export type HealthReport = {
  runtime: string;
  version: string;
  status: "scaffold" | "degraded" | "ready";
  initialized: boolean;
  capabilities: string[];
  evidence: { pendingOps: number; lastEventTs: number | null; notes: string[] };
  __meta: { reconstructed: boolean; governedProductionGo: false };
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
        "scaffold-only: no entity types, entities, or edges stored",
        "entity-type identity depends on runtime-hkd-registry (scaffold)"
      ]
    },
    __meta: { reconstructed: false, governedProductionGo: false }
  };
}
