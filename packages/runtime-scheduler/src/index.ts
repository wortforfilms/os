/*
 * @maataa/runtime-scheduler
 * Minimal but REAL in-process deterministic scheduler (logical-clock driven).
 *
 * Honest scope: real task registry with deterministic due-evaluation against a
 * caller-advanced logical clock (tick). NOT a wall-clock cron daemon, NOT a
 * distributed job queue. governedProductionGo stays false. Fail-closed.
 */
const RUNTIME = "runtime-scheduler";
const VERSION = "0.1.0-alpha.1";

export type Ok<T> = { isOk: true; data: T; error: null };
export type Err = { isOk: false; data: null; error: { code: string; detail: string } };
export type Result<T> = Ok<T> | Err;
const ok = <T>(data: T): Ok<T> => ({ isOk: true, data, error: null });
const err = (code: string, detail: string): Err => ({ isOk: false, data: null, error: { code, detail } });

export type TaskState = "scheduled" | "due" | "ran" | "cancelled";
export type Task = { id: string; name: string; dueAt: number; state: TaskState; runs: number };

const tasks = new Map<string, Task>();
let clock = 0;
let seq = 0;

export function reset(): void { tasks.clear(); clock = 0; seq = 0; }

/** (1) Schedule a task to fire at logical time >= dueAt. Fail-closed on bad input. */
export function schedule(name: string, dueAt: number): Result<{ id: string; dueAt: number }> {
  if (!name || typeof name !== "string") return err("invalid_name", "schedule: name required");
  if (!Number.isFinite(dueAt) || dueAt < 0) return err("invalid_due", "schedule: dueAt must be a finite tick >= 0");
  const id = `task-${++seq}`;
  tasks.set(id, { id, name, dueAt, state: "scheduled", runs: 0 });
  return ok({ id, dueAt });
}

/** (2) Advance the logical clock; mark newly-due tasks. Fail-closed if clock would go backwards. */
export function tick(delta: number): Result<{ clock: number; due: string[] }> {
  if (!Number.isInteger(delta) || delta < 1) return err("invalid_delta", "tick: delta must be a positive integer");
  clock += delta;
  const due: string[] = [];
  for (const t of tasks.values()) {
    if (t.state === "scheduled" && t.dueAt <= clock) { t.state = "due"; due.push(t.id); }
  }
  return ok({ clock, due });
}

/** (3) Cancel a task. Fail-closed if unknown or already ran. */
export function cancel(id: string): Result<{ id: string }> {
  const t = tasks.get(id);
  if (!t) return err("unknown_task", `cancel: '${id}' not found`);
  if (t.state === "ran") return err("already_ran", `cancel: '${id}' already ran`);
  t.state = "cancelled";
  return ok({ id });
}

/** (4) List tasks, optionally filtered by state. */
export function list(state?: TaskState): Result<{ count: number; items: Task[] }> {
  let items = [...tasks.values()];
  if (state) {
    const valid: TaskState[] = ["scheduled", "due", "ran", "cancelled"];
    if (!valid.includes(state)) return err("invalid_state", `list: unknown state '${state}'`);
    items = items.filter((t) => t.state === state);
  }
  return ok({ count: items.length, items });
}

/** (5) Run all currently-due tasks deterministically (by dueAt then id). Returns ran ids. */
export function runDue(): Result<{ ran: string[]; clock: number }> {
  const ranNow = [...tasks.values()]
    .filter((t) => t.state === "due")
    .sort((a, b) => a.dueAt - b.dueAt || a.id.localeCompare(b.id));
  for (const t of ranNow) { t.state = "ran"; t.runs += 1; }
  return ok({ ran: ranNow.map((t) => t.id), clock });
}

/** (6) Deterministic snapshot of the schedule (sorted) for evidence/replay. */
export function snapshot(): Result<{ clock: number; tasks: Task[] }> {
  const sorted = [...tasks.values()].sort((a, b) => a.dueAt - b.dueAt || a.id.localeCompare(b.id));
  return ok({ clock, tasks: sorted });
}

export type HealthReport = {
  runtime: string; version: string; status: "scaffold" | "degraded" | "ready"; initialized: boolean; capabilities: string[];
  evidence: { clock: number; scheduled: number; due: number; ran: number; cancelled: number; notes: string[] };
  __meta: { reconstructed: boolean; governedProductionGo: false };
};

export function health(): HealthReport {
  const all = [...tasks.values()];
  const count = (s: TaskState) => all.filter((t) => t.state === s).length;
  return {
    runtime: RUNTIME, version: VERSION, status: "ready", initialized: true,
    capabilities: ["schedule", "tick", "cancel", "list", "runDue", "snapshot"],
    evidence: {
      clock, scheduled: count("scheduled"), due: count("due"), ran: count("ran"), cancelled: count("cancelled"),
      notes: [
        "in-process tier: deterministic logical-clock scheduler with real due-evaluation",
        "NOT a wall-clock cron daemon / distributed queue; NOT production-GO (governedProductionGo=false)",
      ],
    },
    __meta: { reconstructed: false, governedProductionGo: false },
  };
}
