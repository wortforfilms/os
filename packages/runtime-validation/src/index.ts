/*
 * @maataa/runtime-validation  (Scientific Validation)
 * Minimal but REAL claim-validation runtime (in-memory tier).
 * Spec: doc/RUNTIME_FEDERATION_2026-05-28.md §4.5
 *
 * NOTE: distinct from hemant-core HSTS. This runtime does scientific/empirical
 * claim assessment. Honest scope: confidence is a transparent function of evidence
 * weights + methodology; moderation starts "pending". Not production-GO.
 */
import RuntimePersistence from "../../runtime-persistence/src/index.ts";

const RUNTIME = "runtime-validation";
const VERSION = "0.1.0-alpha.1";

export type Ok<T>  = { isOk: true;  data: T;    error: null };
export type Err    = { isOk: false; data: null; error: { code: string; detail: string } };
export type Result<T> = Ok<T> | Err;
const ok = <T>(data: T): Ok<T> => ({ isOk: true, data, error: null });
const errR = (code: string, detail: string): Err => ({ isOk: false, data: null, error: { code, detail } });

export type ClaimRef       = { runtime: "runtime-knowledge-graph"; entityId: string };
export type EvidenceItem   = { ref: { runtime: "runtime-hkd-registry"; id: string }; weight: number };
export type MethodologySpec = { approach: "observation" | "experiment" | "meta-analysis" | "replication" | "theoretical"; preregistered: boolean; notes: string };
export type ModerationState = "pending" | "reviewed" | "accepted" | "rejected";
export type ValidationId    = string;
export type ValidationRecord = {
  validationId: ValidationId; claimRef: ClaimRef; methodology: MethodologySpec; evidence: EvidenceItem[];
  confidence: number; uncertainty: { epistemic: number; aleatoric: number }; moderationState: ModerationState; replicationCount: number; ts: number;
};

const records = new Map<ValidationId, ValidationRecord>();
let seq = 0;
let lastEventTs: number | null = null;
const touch = () => { lastEventTs = Date.now(); };

// SQLite persistence layer
const persistence = new RuntimePersistence(RUNTIME);

// Restore from persistence
function restoreFromPersistence(): void {
  const storedRecords = persistence.load("records");
  if (storedRecords.ok && Array.isArray(storedRecords.value)) {
    for (const r of storedRecords.value as ValidationRecord[]) {
      if (r.validationId) records.set(r.validationId, r);
    }
  }
}

// Persist state
function persistState(): void {
  persistence.persist("records", Array.from(records.values()));
}

// Initialize on module load
restoreFromPersistence();

// Aleatoric (irreducible) uncertainty floor by methodology rigor.
const ALEATORIC: Record<MethodologySpec["approach"], number> = {
  replication: 0.05, experiment: 0.1, "meta-analysis": 0.12, observation: 0.2, theoretical: 0.3,
};

function computeConfidence(evidence: EvidenceItem[], methodology: MethodologySpec): number {
  const total = evidence.reduce((s, e) => s + (Number.isFinite(e.weight) ? Math.max(0, e.weight) : 0), 0);
  // Saturating function of total evidence weight; preregistration adds a bounded bonus.
  let c = 1 - Math.exp(-total / 3);
  if (methodology.preregistered) c = Math.min(1, c + 0.1);
  return Math.round(c * 1000) / 1000;
}

export function reset(): void { records.clear(); seq = 0; lastEventTs = null; persistence.clear(); }

export async function submitClaim(claimRef: ClaimRef, evidence: EvidenceItem[], methodology: MethodologySpec): Promise<Result<{ validationId: ValidationId }>> {
  if (!claimRef || claimRef.runtime !== "runtime-knowledge-graph" || !claimRef.entityId) {
    return errR("invalid_claim", "submitClaim: claimRef.entityId (from runtime-knowledge-graph) required");
  }
  if (!Array.isArray(evidence)) return errR("invalid_evidence", "submitClaim: evidence must be an array");
  if (!methodology || !methodology.approach) return errR("invalid_methodology", "submitClaim: methodology.approach required");
  const validationId = `val-${(++seq).toString(36)}`;
  const confidence = computeConfidence(evidence, methodology);
  records.set(validationId, {
    validationId, claimRef, methodology, evidence, confidence,
    uncertainty: { epistemic: Math.round((1 - confidence) * 1000) / 1000, aleatoric: ALEATORIC[methodology.approach] },
    moderationState: "pending", replicationCount: 0, ts: Date.now(),
  });
  touch();
  persistState(); // Persist after changes
  return ok({ validationId });
}

export async function assess(validationId: ValidationId): Promise<Result<ValidationRecord>> {
  const r = records.get(validationId);
  if (!r) return errR("unknown_validation", `assess: '${validationId}' not found`);
  // Assessment marks the record reviewed and recomputes from current evidence.
  r.confidence = computeConfidence(r.evidence, r.methodology);
  r.uncertainty.epistemic = Math.round((1 - r.confidence) * 1000) / 1000;
  if (r.moderationState === "pending") r.moderationState = "reviewed";
  touch();
  persistState(); // Persist after changes
  return ok({ ...r });
}

export async function replicationStatus(validationId: ValidationId): Promise<Result<{ replications: number; agreement: number }>> {
  const r = records.get(validationId);
  if (!r) return errR("unknown_validation", `replicationStatus: '${validationId}' not found`);
  return ok({ replications: r.replicationCount, agreement: r.replicationCount === 0 ? 0 : r.confidence });
}

/** Record an independent replication of a claim (raises replication count). */
export async function recordReplication(validationId: ValidationId): Promise<Result<{ replicationCount: number }>> {
  const r = records.get(validationId);
  if (!r) return errR("unknown_validation", `recordReplication: '${validationId}' not found`);
  r.replicationCount += 1;
  touch();
  persistState();
  return ok({ replicationCount: r.replicationCount });
}

/** Moderate a claim: transition to accepted/rejected. Fail-closed: a claim must be
 * reviewed first (assess), and a finalised claim cannot be re-moderated. */
export async function moderate(validationId: ValidationId, decision: "accepted" | "rejected"): Promise<Result<ValidationRecord>> {
  const r = records.get(validationId);
  if (!r) return errR("unknown_validation", `moderate: '${validationId}' not found`);
  if (decision !== "accepted" && decision !== "rejected") return errR("invalid_decision", "moderate: decision must be accepted|rejected");
  if (r.moderationState === "pending") return errR("not_reviewed", "moderate: claim must be assessed (reviewed) before moderation");
  if (r.moderationState === "accepted" || r.moderationState === "rejected") return errR("already_finalised", `moderate: claim already ${r.moderationState}`);
  r.moderationState = decision;
  touch();
  persistState();
  return ok({ ...r });
}

export type HealthReport = {
  runtime: string; version: string; status: "scaffold" | "degraded" | "ready"; initialized: boolean; capabilities: string[];
  evidence: { pendingOps: number; lastEventTs: number | null; claimCount: number; pendingAssessments: number; averageConfidence: number | null; persistence: ReturnType<RuntimePersistence["health"]>; notes: string[] };
  __meta: { reconstructed: boolean; governedProductionGo: false };
};

export function health(): HealthReport {
  const all = [...records.values()];
  const avg = all.length ? Math.round((all.reduce((s, r) => s + r.confidence, 0) / all.length) * 1000) / 1000 : null;
  return {
    runtime: RUNTIME, version: VERSION, status: "ready", initialized: true,
    capabilities: ["submitClaim", "assess", "replicationStatus"],
    evidence: {
      pendingOps: 0, lastEventTs,
      claimCount: all.length,
      pendingAssessments: all.filter((r) => r.moderationState === "pending").length,
      averageConfidence: avg,
      persistence: persistence.health(),
      notes: [
        "in-memory tier: confidence is a transparent saturating function of evidence weight + methodology",
        "state persisted to SQLite via runtime-persistence",
        "moderation starts 'pending' — no auto-accept; NOT production-GO (governedProductionGo=false)",
      ],
    },
    __meta: { reconstructed: false, governedProductionGo: false },
  };
}
