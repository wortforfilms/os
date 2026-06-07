/*
 * @maataa/runtime-research
 * Minimal but REAL in-process research-record runtime.
 *
 * Honest scope: hypotheses with attached experiments and weighted evidence (for /
 * against). assess() computes a transparent support score from the real evidence —
 * it does not decide truth. This is the in-process tier — NOT the board's
 * "Research Knowledge Graph" with thousands of papers/authors. No record is
 * accepted as fact; status is advisory. governedProductionGo stays false. Fail-closed.
 */
const RUNTIME = "runtime-research";
const VERSION = "0.1.0-alpha.1";

export type Ok<T> = { isOk: true; data: T; error: null };
export type Err = { isOk: false; data: null; error: { code: string; detail: string } };
export type Result<T> = Ok<T> | Err;
const ok = <T>(data: T): Ok<T> => ({ isOk: true, data, error: null });
const err = (code: string, detail: string): Err => ({ isOk: false, data: null, error: { code, detail } });

export type Experiment = { method: string; result: string; ts: number };
export type Evidence = { ref: string; weight: number; supports: boolean };
export type Status = "supported" | "refuted" | "inconclusive";
type Hypothesis = { id: string; statement: string; experiments: Experiment[]; evidence: Evidence[]; ts: number };

const hyps = new Map<string, Hypothesis>();
let seq = 0;
let lastEventTs: number | null = null;
const touch = () => { lastEventTs = Date.now(); };

export function reset(): void { hyps.clear(); seq = 0; lastEventTs = null; }

/** (1) Register a hypothesis. */
export function registerHypothesis(statement: string): Result<{ id: string }> {
  if (!statement || typeof statement !== "string") return err("invalid_statement", "registerHypothesis: statement required");
  const id = `hyp-${(++seq).toString(36)}`;
  hyps.set(id, { id, statement, experiments: [], evidence: [], ts: Date.now() });
  touch();
  return ok({ id });
}

/** (2) Attach an experiment (method + observed result) to a hypothesis. */
export function addExperiment(id: string, method: string, result: string): Result<{ experiments: number }> {
  const h = hyps.get(id);
  if (!h) return err("unknown_hypothesis", `addExperiment: '${id}' not found`);
  if (!method || !result) return err("invalid_experiment", "addExperiment: method and result required");
  h.experiments.push({ method, result, ts: Date.now() });
  touch();
  return ok({ experiments: h.experiments.length });
}

/** (3) Attach weighted evidence for or against a hypothesis. */
export function addEvidence(id: string, ev: Evidence): Result<{ evidence: number }> {
  const h = hyps.get(id);
  if (!h) return err("unknown_hypothesis", `addEvidence: '${id}' not found`);
  if (!ev || typeof ev.ref !== "string" || typeof ev.weight !== "number" || typeof ev.supports !== "boolean") {
    return err("invalid_evidence", "addEvidence: ref(string), weight(number), supports(boolean) required");
  }
  h.evidence.push({ ref: ev.ref, weight: Math.max(0, ev.weight), supports: ev.supports });
  touch();
  return ok({ evidence: h.evidence.length });
}

/** (4) Assess: transparent support score in [-1,1] + advisory status. Fail-closed. */
export function assess(id: string): Result<{ supportScore: number; status: Status; for: number; against: number; experiments: number }> {
  const h = hyps.get(id);
  if (!h) return err("unknown_hypothesis", `assess: '${id}' not found`);
  const forW = h.evidence.filter((e) => e.supports).reduce((s, e) => s + e.weight, 0);
  const againstW = h.evidence.filter((e) => !e.supports).reduce((s, e) => s + e.weight, 0);
  const total = forW + againstW;
  const score = total === 0 ? 0 : Math.round(((forW - againstW) / total) * 1000) / 1000;
  const status: Status = score > 0.2 ? "supported" : score < -0.2 ? "refuted" : "inconclusive";
  return ok({ supportScore: score, status, for: forW, against: againstW, experiments: h.experiments.length });
}

/** (5) List hypotheses with their current assessed status. */
export function list(): Result<{ count: number; items: Array<{ id: string; statement: string; status: Status; supportScore: number }> }> {
  const items = [...hyps.values()].map((h) => {
    const a = assess(h.id) as Ok<{ supportScore: number; status: Status }>;
    return { id: h.id, statement: h.statement, status: a.data.status, supportScore: a.data.supportScore };
  });
  return ok({ count: items.length, items });
}

export type HealthReport = {
  runtime: string; version: string; status: "scaffold" | "degraded" | "ready"; initialized: boolean; capabilities: string[];
  evidence: { pendingOps: number; lastEventTs: number | null; hypotheses: number; totalEvidence: number; notes: string[] };
  __meta: { reconstructed: boolean; governedProductionGo: false };
};

export function health(): HealthReport {
  const all = [...hyps.values()];
  return {
    runtime: RUNTIME, version: VERSION, status: "ready", initialized: true,
    capabilities: ["registerHypothesis", "addExperiment", "addEvidence", "assess", "list"],
    evidence: {
      pendingOps: 0, lastEventTs,
      hypotheses: all.length,
      totalEvidence: all.reduce((s, h) => s + h.evidence.length, 0),
      notes: [
        "in-process tier: hypotheses + weighted evidence; support score is a transparent ratio, not a truth verdict",
        "NOT the board's 'Research Knowledge Graph' of thousands of papers/authors; counts are the real values",
        "NOT production-GO (governedProductionGo=false)",
      ],
    },
    __meta: { reconstructed: false, governedProductionGo: false },
  };
}
