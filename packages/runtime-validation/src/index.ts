/*
 * @maataa/runtime-validation  (Scientific Validation)
 * Scaffold-only. Every method returns fail-closed not_implemented results.
 * Spec: doc/RUNTIME_FEDERATION_2026-05-28.md §4.5
 *
 * NOTE: distinct from hemant-core HSTS.
 * HSTS = runtime trust state machine for the embedded kernel.
 * This runtime = scientific/empirical claim assessment.
 * Do not import or shadow HSTS primitives here.
 */

const RUNTIME = "runtime-validation";
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
export type ClaimRef       = { runtime: "runtime-knowledge-graph"; entityId: string };
export type EvidenceItem   = { ref: { runtime: "runtime-hkd-registry"; id: string }; weight: number };
export type MethodologySpec = {
  approach: "observation" | "experiment" | "meta-analysis" | "replication" | "theoretical";
  preregistered: boolean;
  notes: string;
};
export type ModerationState = "pending" | "reviewed" | "accepted" | "rejected";
export type ValidationId    = string;

export type ValidationRecord = {
  validationId: ValidationId;
  claimRef: ClaimRef;
  methodology: MethodologySpec;
  evidence: EvidenceItem[];
  confidence: number;                   // 0..1
  uncertainty: { epistemic: number; aleatoric: number };
  moderationState: ModerationState;
  replicationCount: number;
  ts: number;
};

// ---- Facade ---------------------------------------------------------------
export async function submitClaim(
  _claimRef: ClaimRef,
  _evidence: EvidenceItem[],
  _methodology: MethodologySpec
): Promise<Result<{ validationId: ValidationId }>> {
  return notImplemented("submitClaim");
}

export async function assess(_validationId: ValidationId): Promise<Result<ValidationRecord>> {
  return notImplemented("assess");
}

export async function replicationStatus(
  _validationId: ValidationId
): Promise<Result<{ replications: number; agreement: number }>> {
  return notImplemented("replicationStatus");
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
    claimCount: number;
    pendingAssessments: number;
    averageConfidence: number | null;
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
      claimCount: 0,
      pendingAssessments: 0,
      averageConfidence: null,
      notes: [
        "scaffold-only: no validations stored",
        "distinct from hemant-core HSTS — do not conflate runtime trust gates with claim validity"
      ]
    },
    __meta: { reconstructed: false, governedProductionGo: false }
  };
}
