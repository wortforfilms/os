/*
 * @maataa/runtime-agent-supervisor
 * Minimal but REAL in-process agent supervisor.
 *
 * Honest scope: an "agent" here is a registered deterministic handler function
 * (task) => result, supervised through a real lifecycle (registered → running →
 * stopped) with a run log. This is the in-process tier — NOT distributed agents,
 * NOT autonomous/AI agents, and emphatically NOT the board's "1,248 deployed
 * agents". governedProductionGo stays false. Fail-closed throughout.
 */
const RUNTIME = "runtime-agent-supervisor";
const VERSION = "0.1.0-alpha.1";

export type Ok<T> = { isOk: true; data: T; error: null };
export type Err = { isOk: false; data: null; error: { code: string; detail: string } };
export type Result<T> = Ok<T> | Err;
const ok = <T>(data: T): Ok<T> => ({ isOk: true, data, error: null });
const err = (code: string, detail: string): Err => ({ isOk: false, data: null, error: { code, detail } });

export type AgentState = "registered" | "running" | "stopped";
export type AgentHandler = (task: unknown) => unknown;
export type RunLogEntry = { ts: number; ok: boolean; detail?: string };
type Agent = {
  id: string; name: string; handler: AgentHandler; state: AgentState;
  runs: number; failures: number; lastRunTs: number | null;
  tags: string[]; queue: unknown[]; runLog: RunLogEntry[]; maxFailures: number | null;
};

const agents = new Map<string, Agent>();
let seq = 0;
let lastEventTs: number | null = null;
const touch = () => { lastEventTs = Date.now(); };

export function reset(): void { agents.clear(); seq = 0; lastEventTs = null; }

/** (1) Register a deterministic handler as a supervised agent (optional capability tags). */
export function registerAgent(name: string, handler: AgentHandler, opts?: { tags?: string[] }): Result<{ id: string }> {
  if (!name || typeof name !== "string") return err("invalid_name", "registerAgent: name required");
  if (typeof handler !== "function") return err("invalid_handler", "registerAgent: handler must be a function");
  const id = `agent-${(++seq).toString(36)}`;
  agents.set(id, {
    id, name, handler, state: "registered", runs: 0, failures: 0, lastRunTs: null,
    tags: Array.isArray(opts?.tags) ? opts.tags : [], queue: [], runLog: [], maxFailures: null,
  });
  touch();
  return ok({ id });
}

/** (2a) Start an agent (registered|stopped → running). */
export function start(id: string): Result<{ id: string; state: AgentState }> {
  const a = agents.get(id);
  if (!a) return err("unknown_agent", `start: '${id}' not found`);
  a.state = "running";
  touch();
  return ok({ id, state: a.state });
}

/** (2b) Stop an agent (→ stopped). */
export function stop(id: string): Result<{ id: string; state: AgentState }> {
  const a = agents.get(id);
  if (!a) return err("unknown_agent", `stop: '${id}' not found`);
  a.state = "stopped";
  touch();
  return ok({ id, state: a.state });
}

/** (3) Run a task through a RUNNING agent. Fail-closed: unknown or not-running
 * agents are rejected; a throwing handler is caught and counted, not crashed. */
export function runTask(id: string, task: unknown): Result<{ result: unknown; runs: number }> {
  const a = agents.get(id);
  if (!a) return err("unknown_agent", `runTask: '${id}' not found`);
  if (a.state !== "running") return err("agent_not_running", `runTask: agent '${id}' is '${a.state}', not running`);
  a.lastRunTs = Date.now();
  try {
    const result = a.handler(task);
    a.runs += 1;
    a.runLog.push({ ts: a.lastRunTs, ok: true });
    touch();
    return ok({ result, runs: a.runs });
  } catch (e) {
    a.failures += 1;
    a.runLog.push({ ts: a.lastRunTs, ok: false, detail: (e as Error).message });
    // Failure-threshold supervision: auto-stop a flapping agent (fail-closed safety).
    if (a.maxFailures != null && a.failures >= a.maxFailures) a.state = "stopped";
    touch();
    return err("handler_threw", `runTask: agent '${id}' handler threw: ${(e as Error).message}`);
  }
}

/** (4) Status of one agent. */
export function status(id: string): Result<{ id: string; name: string; state: AgentState; runs: number; failures: number }> {
  const a = agents.get(id);
  if (!a) return err("unknown_agent", `status: '${id}' not found`);
  return ok({ id: a.id, name: a.name, state: a.state, runs: a.runs, failures: a.failures });
}

/** (5) List the real supervised agents (honest count — never inflated). */
export function list(): Result<{ count: number; running: number; agents: Array<{ id: string; name: string; state: AgentState; runs: number }> }> {
  const all = [...agents.values()];
  return ok({
    count: all.length,
    running: all.filter((a) => a.state === "running").length,
    agents: all.map((a) => ({ id: a.id, name: a.name, state: a.state, runs: a.runs })),
  });
}

/** (6) Enqueue a task for an agent (buffered work). */
export function enqueue(id: string, task: unknown): Result<{ queued: number }> {
  const a = agents.get(id);
  if (!a) return err("unknown_agent", `enqueue: '${id}' not found`);
  a.queue.push(task);
  touch();
  return ok({ queued: a.queue.length });
}

/** (7) Drain an agent's queue: run buffered tasks in FIFO order. Fail-closed if not running. */
export function processQueue(id: string): Result<{ processed: number; results: unknown[] }> {
  const a = agents.get(id);
  if (!a) return err("unknown_agent", `processQueue: '${id}' not found`);
  if (a.state !== "running") return err("agent_not_running", `processQueue: agent '${id}' is '${a.state}'`);
  const results: unknown[] = [];
  const pending = a.queue.splice(0, a.queue.length);
  for (const task of pending) {
    const r = runTask(id, task);
    results.push(r.isOk ? r.data.result : { error: r.error.code });
  }
  return ok({ processed: pending.length, results });
}

/** (8) Run history (audit) for an agent. */
export function history(id: string): Result<{ runs: RunLogEntry[] }> {
  const a = agents.get(id);
  if (!a) return err("unknown_agent", `history: '${id}' not found`);
  return ok({ runs: [...a.runLog] });
}

/** (9) Route a task to the first RUNNING agent advertising a capability tag. */
export function route(tag: string, task: unknown): Result<{ agentId: string; result: unknown }> {
  const target = [...agents.values()].find((a) => a.state === "running" && a.tags.includes(tag));
  if (!target) return err("no_capable_agent", `route: no running agent with tag '${tag}'`);
  const r = runTask(target.id, task);
  if (!r.isOk) return r as Err;
  return ok({ agentId: target.id, result: r.data.result });
}

/** (10) Set a failure-threshold policy: auto-stop the agent after maxFailures. */
export function setFailurePolicy(id: string, maxFailures: number): Result<{ maxFailures: number }> {
  const a = agents.get(id);
  if (!a) return err("unknown_agent", `setFailurePolicy: '${id}' not found`);
  if (!Number.isInteger(maxFailures) || maxFailures < 1) return err("invalid_policy", "setFailurePolicy: maxFailures must be a positive integer");
  a.maxFailures = maxFailures;
  touch();
  return ok({ maxFailures });
}

/** (11) Fan a single task out across multiple running agents; collect per-agent results. */
export function fanOut(ids: string[], task: unknown): Result<{ results: Array<{ id: string; ok: boolean; result?: unknown; error?: string }> }> {
  if (!Array.isArray(ids) || ids.length === 0) return err("no_agents", "fanOut: provide ≥1 agent id");
  const results = ids.map((id) => {
    const r = runTask(id, task);
    return r.isOk ? { id, ok: true, result: r.data.result } : { id, ok: false, error: r.error.code };
  });
  return ok({ results });
}

export type HealthReport = {
  runtime: string; version: string; status: "scaffold" | "degraded" | "ready"; initialized: boolean; capabilities: string[];
  evidence: { pendingOps: number; lastEventTs: number | null; agentCount: number; running: number; totalRuns: number; notes: string[] };
  __meta: { reconstructed: boolean; governedProductionGo: false };
};

export function health(): HealthReport {
  const all = [...agents.values()];
  return {
    runtime: RUNTIME, version: VERSION, status: "ready", initialized: true,
    capabilities: ["registerAgent", "start", "stop", "runTask", "status", "list"],
    evidence: {
      pendingOps: 0, lastEventTs,
      agentCount: all.length,
      running: all.filter((a) => a.state === "running").length,
      totalRuns: all.reduce((s, a) => s + a.runs, 0),
      notes: [
        "in-process tier: agents are real registered handler functions, supervised through a real lifecycle",
        "NOT distributed/AI agents and NOT the board's '1,248 deployed agents'; count is the real in-memory count",
        "NOT production-GO (governedProductionGo=false)",
      ],
    },
    __meta: { reconstructed: false, governedProductionGo: false },
  };
}
