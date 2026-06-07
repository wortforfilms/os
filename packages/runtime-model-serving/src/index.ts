/*
 * @maataa/runtime-model-serving
 * Minimal but REAL in-process model-serving runtime.
 *
 * Honest scope: a "model" here is a registered deterministic function
 * (input) => output. Inference really runs it; evaluation really measures accuracy
 * on the samples you provide. This is the in-process tier — NOT ML/LLMs, NOT the
 * board's "162+ models" or fabricated "94.3% accuracy". Counts and accuracy are
 * the real measured values. governedProductionGo stays false. Fail-closed.
 */
const RUNTIME = "runtime-model-serving";
const VERSION = "0.1.0-alpha.1";

export type Ok<T> = { isOk: true; data: T; error: null };
export type Err = { isOk: false; data: null; error: { code: string; detail: string } };
export type Result<T> = Ok<T> | Err;
const ok = <T>(data: T): Ok<T> => ({ isOk: true, data, error: null });
const err = (code: string, detail: string): Err => ({ isOk: false, data: null, error: { code, detail } });

export type ModelFn = (input: unknown) => unknown;
export type Sample = { input: unknown; expected: unknown };
type Model = { id: string; name: string; version: number; fn: ModelFn; inferences: number; lastTs: number | null };

const models = new Map<string, Model>();
let seq = 0;
let lastEventTs: number | null = null;
const touch = () => { lastEventTs = Date.now(); };

export function reset(): void { models.clear(); seq = 0; lastEventTs = null; }

/** (1) Register a deterministic model function (name + optional version). */
export function registerModel(name: string, fn: ModelFn, opts?: { version?: number }): Result<{ id: string; version: number }> {
  if (!name || typeof name !== "string") return err("invalid_name", "registerModel: name required");
  if (typeof fn !== "function") return err("invalid_model", "registerModel: fn must be a function");
  const version = Number.isInteger(opts?.version) ? (opts!.version as number) : 1;
  const id = `model-${(++seq).toString(36)}`;
  models.set(id, { id, name, version, fn, inferences: 0, lastTs: null });
  touch();
  return ok({ id, version });
}

/** (2) Run inference through a model by id. Fail-closed on unknown id. */
export function infer(id: string, input: unknown): Result<{ output: unknown; inferences: number }> {
  const m = models.get(id);
  if (!m) return err("unknown_model", `infer: model '${id}' not found`);
  const output = m.fn(input);
  m.inferences += 1;
  m.lastTs = Date.now();
  touch();
  return ok({ output, inferences: m.inferences });
}

/** (3) Version routing: infer by name, latest version by default or a pinned one. */
export function inferByName(name: string, input: unknown, version?: number): Result<{ id: string; version: number; output: unknown }> {
  const candidates = [...models.values()].filter((m) => m.name === name && (version === undefined || m.version === version));
  if (candidates.length === 0) return err("no_such_model", `inferByName: no model '${name}'${version ? "@" + version : ""}`);
  const chosen = candidates.sort((a, b) => b.version - a.version)[0]; // latest unless pinned
  const r = infer(chosen.id, input);
  if (!r.isOk) return r as Err;
  return ok({ id: chosen.id, version: chosen.version, output: r.data.output });
}

/** (4) Real inference metrics for a model. */
export function metrics(id: string): Result<{ name: string; version: number; inferences: number; lastTs: number | null }> {
  const m = models.get(id);
  if (!m) return err("unknown_model", `metrics: model '${id}' not found`);
  return ok({ name: m.name, version: m.version, inferences: m.inferences, lastTs: m.lastTs });
}

/** (5) Evaluate a model over labelled samples → MEASURED accuracy (never fabricated). */
export function evaluate(id: string, samples: Sample[]): Result<{ n: number; correct: number; accuracy: number }> {
  const m = models.get(id);
  if (!m) return err("unknown_model", `evaluate: model '${id}' not found`);
  if (!Array.isArray(samples) || samples.length === 0) return err("no_samples", "evaluate: provide ≥1 sample");
  let correct = 0;
  for (const s of samples) {
    const out = m.fn(s.input);
    if (JSON.stringify(out) === JSON.stringify(s.expected)) correct += 1;
  }
  m.inferences += samples.length;
  touch();
  return ok({ n: samples.length, correct, accuracy: Math.round((correct / samples.length) * 1000) / 1000 });
}

export type HealthReport = {
  runtime: string; version: string; status: "scaffold" | "degraded" | "ready"; initialized: boolean; capabilities: string[];
  evidence: { pendingOps: number; lastEventTs: number | null; modelCount: number; totalInferences: number; notes: string[] };
  __meta: { reconstructed: boolean; governedProductionGo: false };
};

export function health(): HealthReport {
  const all = [...models.values()];
  return {
    runtime: RUNTIME, version: VERSION, status: "ready", initialized: true,
    capabilities: ["registerModel", "infer", "inferByName", "metrics", "evaluate"],
    evidence: {
      pendingOps: 0, lastEventTs,
      modelCount: all.length,
      totalInferences: all.reduce((s, m) => s + m.inferences, 0),
      notes: [
        "in-process tier: models are real deterministic functions; inference and accuracy are measured",
        "NOT ML/LLMs, NOT the board's '162+ models' or fabricated accuracy scores; counts are the real values",
        "NOT production-GO (governedProductionGo=false)",
      ],
    },
    __meta: { reconstructed: false, governedProductionGo: false },
  };
}
