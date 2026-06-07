/*
 * @maataa/runtime-mission   (Reality-to-Mission)
 * Minimal but REAL advisory mission runtime.
 * Spec: doc/RUNTIME_FEDERATION_2026-05-28.md §4.4
 *
 * NOTE: this runtime measures and PROPOSES. Enforcement
 * is delegated to runtime-governance via enforceProposal().
 */
import { createHash } from "node:crypto";
import * as governance from "../../runtime-governance/src/index.ts";
import RuntimePersistence from "../../runtime-persistence/src/index.ts";

const RUNTIME = "runtime-mission";
const VERSION = "0.1.0-alpha.1";

// ---- Result envelope ------------------------------------------------------
export type Ok<T>  = { isOk: true;  data: T;    error: null };
export type Err    = { isOk: false; data: null; error: { code: string; detail: string } };
export type Result<T> = Ok<T> | Err;

const ok = <T>(data: T): Ok<T> => ({ isOk: true, data, error: null });
const err = (code: string, detail: string): Err => ({ isOk: false, data: null, error: { code, detail } });

// ---- Contract types -------------------------------------------------------
export type MissionId = string;

export type MissionSpec = {
  name: string;
  declaredState: Record<string, unknown>;
  observableQueries: string[];
  acceptanceThresholds: Record<string, number>;
};

export type DriftItem = {
  key: string;
  declared: unknown;
  observed: unknown;
  confidence: number;
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
  enforcement: "deferred-to-runtime-governance";
};

// ---- In-memory store ------------------------------------------------------
type StoredMission = { id: MissionId; spec: MissionSpec; observed: Record<string, unknown> };
const missions = new Map<MissionId, StoredMission>();
let seq = 0;
let lastEventTs: number | null = null;
let lastAssessmentTs: number | null = null;
const touch = () => { lastEventTs = Date.now(); };
const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v ?? null)).digest("hex").slice(0, 16);

// SQLite persistence layer
const persistence = new RuntimePersistence(RUNTIME);

// Restore missions from persistence on startup
function restoreFromPersistence(): void {
  const missionRecords = persistence.load("missions");
  if (missionRecords.ok && Array.isArray(missionRecords.value)) {
    for (const m of missionRecords.value as StoredMission[]) {
      if (m.id && m.spec) {
        missions.set(m.id, m);
      }
    }
  }
}

// Persist missions after changes
function persistMissions(): void {
  const missionArray = Array.from(missions.values());
  persistence.persist("missions", missionArray);
}

// Initialize on module load
restoreFromPersistence();

/** Reset store (test/operational helper). */
export function reset(): void { missions.clear(); seq = 0; lastEventTs = null; lastAssessmentTs = null; persistence.clear(); }

/**
 * Record an observed reality value for a mission key. This is how reality is fed
 * in until KG/observability integration is wired; honest and explicit.
 */
export function recordObservation(missionId: MissionId, key: string, value: unknown): Result<true> {
  const m = missions.get(missionId);
  if (!m) return err("unknown_mission", `recordObservation: mission '${missionId}' not found`);
  m.observed[key] = value;
  touch();
  return ok(true);
}

// ---- Facade ---------------------------------------------------------------
export async function declareMission(spec: MissionSpec): Promise<Result<{ missionId: MissionId }>> {
  if (!spec || typeof spec.name !== "string" || spec.name.trim() === "") {
    return err("invalid_spec", "declareMission: spec.name is required");
  }
  if (!spec.declaredState || typeof spec.declaredState !== "object") {
    return err("invalid_spec", "declareMission: declaredState must be an object");
  }
  const missionId = `mission:${spec.name}`;
  missions.set(missionId, { id: missionId, spec, observed: {} });
  touch();
  persistMissions(); // Persist after changes
  return ok({ missionId });
}

export async function assess(missionId: MissionId): Promise<Result<DriftReport>> {
  const m = missions.get(missionId);
  if (!m) return err("unknown_mission", `assess: mission '${missionId}' not found`);
  const ts = Date.now();
  lastAssessmentTs = ts;
  const driftItems: DriftItem[] = [];
  for (const [key, declared] of Object.entries(m.spec.declaredState)) {
    const hasObs = Object.prototype.hasOwnProperty.call(m.observed, key);
    const observed = hasObs ? m.observed[key] : undefined;
    const matches = hasObs && JSON.stringify(observed) === JSON.stringify(declared);
    if (matches) continue; // no drift on this key
    driftItems.push({
      key,
      declared,
      observed,
      // confidence reflects whether reality was actually observed
      confidence: hasObs ? 1 : 0.1,
      lineage: hasObs
        ? [{ runtime: "runtime-mission", ref: "recordObservation" }]
        : [{ runtime: "runtime-mission", ref: "unobserved" }],
    });
  }
  return ok({
    missionId,
    ts,
    declaredStateDigest: digest(m.spec.declaredState),
    observedStateDigest: digest(m.observed),
    driftItems,
  });
}

export async function propose(missionId: MissionId): Promise<Result<ProposedActions>> {
  const m = missions.get(missionId);
  if (!m) return err("unknown_mission", `propose: mission '${missionId}' not found`);
  const assessment = await assess(missionId);
  if (!assessment.isOk) return assessment as Err;
  const candidates = assessment.data.driftItems.map((d) => ({
    summary: d.confidence >= 1
      ? `Reconcile '${d.key}': observed differs from declared`
      : `Observe '${d.key}': declared value has no reality measurement yet`,
    targetRuntime: d.confidence >= 1 ? "runtime-knowledge-graph" : "runtime-observability",
    payload: { key: d.key, declared: d.declared, observed: d.observed },
  }));
  return ok({ missionId, ts: Date.now(), candidates, enforcement: "deferred-to-runtime-governance" });
}

/**
 * Wire a proposed action through runtime-governance enforcement.
 * Takes a candidate from propose() and evaluates it against governance policies.
 */
export function enforceProposal(candidate: ProposedActions["candidates"][number]): governance.Result<governance.EnforcementRecord> {
  const ctx = {
    targetRuntime: candidate.targetRuntime,
    summary: candidate.summary,
    ...((candidate.payload as Record<string, unknown>) ?? {}),
  };
  return governance.enforce(ctx);
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
    enforcementOwner: "runtime-governance (wired)";
    persistence: ReturnType<RuntimePersistence["health"]>;
    notes: string[];
  };
  __meta: { reconstructed: boolean; governedProductionGo: false };
};

export function health(): HealthReport {
  return {
    runtime: RUNTIME,
    version: VERSION,
    status: "ready",
    initialized: true,
    capabilities: ["declareMission", "recordObservation", "assess", "propose", "enforceProposal"],
    evidence: {
      pendingOps: 0,
      lastEventTs,
      missionCount: missions.size,
      lastAssessmentTs,
      enforcementOwner: "runtime-governance (wired)",
      persistence: persistence.health(),
      notes: [
        "in-memory advisory tier: declare/assess/propose execute for real",
        "missions persisted to SQLite via runtime-persistence",
        "proposals wired to runtime-governance.enforce for policy evaluation",
        "NOT production-GO (governedProductionGo=false)",
      ],
    },
    __meta: { reconstructed: false, governedProductionGo: false },
  };
}
