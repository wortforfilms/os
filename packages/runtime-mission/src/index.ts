/*
 * @maataa/runtime-mission   (Reality-to-Mission)
 * Scaffold-only. Every method returns fail-closed not_implemented results.
 * Spec: doc/RUNTIME_FEDERATION_2026-05-28.md §4.4
 *
 * NOTE: this runtime measures and PROPOSES. It never enforces.
 * Enforcement requires runtime-governance, which is not in this batch.
 */

const RUNTIME = "runtime-mission";
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
export type MissionId = string;

export type MissionSpec = {
  name: string;
  declaredState: Record<string, unknown>;     // intended invariants
  observableQueries: string[];                // graph queries that describe reality
  acceptanceThresholds: Record<string, number>;
};

export type DriftItem = {
  key: string;
  declared: unknown;
  observed: unknown;
  confidence: number;        // 0..1
  lineage: Array<{ runtime: string; ref: string }>;
};

export type DriftReport = {
  missionId: MissionId;
  ts: number;
  declaredStateDigest: string;
  observedStateDigest: string;
  driftItems: DriftItem[];
};

export type ProposedActions = {
  missionId: MissionId;
  ts: number;
  candidates: Array<{ summary: string; targetRuntime: string; payload: unknown }>;
  enforcement: "none — runtime-governance vacant";
};

// ---- Facade ---------------------------------------------------------------
export async function declareMission(_spec: MissionSpec): Promise<Result<{ missionId: MissionId }>> {
  return notImplemented("declareMission");
}

export async function assess(_missionId: MissionId): Promise<Result<DriftReport>> {
  return notImplemented("assess");
}

export async function propose(_missionId: MissionId): Promise<Result<ProposedActions>> {
  return notImplemented("propose");
}

// ---- Observable surface ---------------------------------------------------
export type HealthReport = {
  runtime: string;
  version: string;
  status: "scaffold" | "degraded" | "ready";
  initialized: boolean;
  capabilities: string[];
  evidence: {
    pendingOps: number;
    lastEventTs: number | null;
    missionCount: number;
    lastAssessmentTs: number | null;
    enforcementOwner: "runtime-governance (vacant)";
    notes: string[];
  };
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
      missionCount: 0,
      lastAssessmentTs: null,
      enforcementOwner: "runtime-governance (vacant)",
      notes: [
        "scaffold-only: no mission specs, no assessments",
        "reads KG + validation + observability when implemented; never writes them",
        "advisory output only — enforcement runtime not present"
      ]
    },
    __meta: { reconstructed: false, governedProductionGo: false }
  };
}
