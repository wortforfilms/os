/*
 * @maataa/runtime-fsm
 * Minimal but REAL deterministic finite-state machine for governed workflows.
 *
 * Honest scope: real deterministic transition table, guarded transitions, full
 * transition history for audit. In-process advisory workflow engine — NOT a
 * distributed workflow orchestrator, NOT BPMN, NOT a saga coordinator.
 * governedProductionGo stays false. Fail-closed.
 */
const RUNTIME = "runtime-fsm";
const VERSION = "0.1.0-alpha.1";

export type Ok<T> = { isOk: true; data: T; error: null };
export type Err = { isOk: false; data: null; error: { code: string; detail: string } };
export type Result<T> = Ok<T> | Err;
const ok = <T>(data: T): Ok<T> => ({ isOk: true, data, error: null });
const err = (code: string, detail: string): Err => ({ isOk: false, data: null, error: { code, detail } });

export type Transition = { from: string; event: string; to: string };
export type HistoryEntry = { from: string; event: string; to: string; at: number };

type Machine = {
  states: Set<string>;
  initial: string;
  transitions: Map<string, string>; // key `${from}|${event}` → to
  current: string;
  history: HistoryEntry[];
};

let machine: Machine | null = null;
let seq = 0;
const stamp = () => ++seq; // deterministic logical timestamp (not wall-clock)

export function reset(): void { machine = null; seq = 0; }

/** (1) Define the machine: states, initial, and a deterministic transition table. */
export function define(spec: { states: string[]; initial: string; transitions: Transition[] }): Result<{ states: number; transitions: number }> {
  if (!spec || !Array.isArray(spec.states) || spec.states.length === 0) return err("invalid_states", "define: non-empty states[] required");
  if (typeof spec.initial !== "string" || !spec.states.includes(spec.initial)) return err("invalid_initial", "define: initial must be one of states");
  if (!Array.isArray(spec.transitions)) return err("invalid_transitions", "define: transitions[] required");
  const states = new Set(spec.states);
  const table = new Map<string, string>();
  for (const t of spec.transitions) {
    if (!states.has(t.from) || !states.has(t.to)) return err("unknown_state", `define: transition references unknown state (${t.from}→${t.to})`);
    if (!t.event) return err("invalid_event", "define: transition event required");
    const key = `${t.from}|${t.event}`;
    if (table.has(key)) return err("nondeterministic", `define: duplicate (state,event) makes machine non-deterministic: ${key}`);
    table.set(key, t.to);
  }
  machine = { states, initial: spec.initial, transitions: table, current: spec.initial, history: [] };
  return ok({ states: states.size, transitions: table.size });
}

/** (2) Send an event; transition deterministically. Fail-closed on undefined transitions. */
export function send(event: string): Result<{ from: string; to: string; event: string }> {
  if (!machine) return err("undefined_machine", "send: define() a machine first");
  const from = machine.current;
  const to = machine.transitions.get(`${from}|${event}`);
  if (to === undefined) return err("no_transition", `send: no transition for (${from}, ${event}) — fail-closed`);
  machine.current = to;
  machine.history.push({ from, event, to, at: stamp() });
  return ok({ from, to, event });
}

/** (3) Current state. */
export function state(): Result<{ state: string }> {
  if (!machine) return err("undefined_machine", "state: define() a machine first");
  return ok({ state: machine.current });
}

/** (4) Whether an event is allowed from the current state (no side effects). */
export function can(event: string): Result<{ allowed: boolean; to: string | null }> {
  if (!machine) return err("undefined_machine", "can: define() a machine first");
  const to = machine.transitions.get(`${machine.current}|${event}`);
  return ok({ allowed: to !== undefined, to: to ?? null });
}

/** (5) Full ordered transition history for audit. */
export function history(): Result<{ count: number; entries: HistoryEntry[] }> {
  if (!machine) return err("undefined_machine", "history: define() a machine first");
  return ok({ count: machine.history.length, entries: machine.history.slice() });
}

/** (6) Reset the running machine to its initial state (history cleared, definition kept). */
export function restart(): Result<{ state: string }> {
  if (!machine) return err("undefined_machine", "restart: define() a machine first");
  machine.current = machine.initial;
  machine.history = [];
  return ok({ state: machine.current });
}

/** (7) Deterministic snapshot of definition + runtime state for evidence/replay. */
export function snapshot(): Result<{ initial: string; current: string; states: string[]; transitions: Transition[]; historyLen: number }> {
  if (!machine) return err("undefined_machine", "snapshot: define() a machine first");
  const transitions: Transition[] = [...machine.transitions.entries()]
    .map(([k, to]) => { const [from, event] = k.split("|"); return { from, event, to }; })
    .sort((a, b) => (a.from + a.event).localeCompare(b.from + b.event));
  return ok({
    initial: machine.initial,
    current: machine.current,
    states: [...machine.states].sort(),
    transitions,
    historyLen: machine.history.length,
  });
}

export type HealthReport = {
  runtime: string; version: string; status: "scaffold" | "degraded" | "ready"; initialized: boolean; capabilities: string[];
  evidence: { defined: boolean; current: string | null; transitions: number; historyLen: number; notes: string[] };
  __meta: { reconstructed: boolean; governedProductionGo: false };
};

export function health(): HealthReport {
  return {
    runtime: RUNTIME, version: VERSION, status: "ready", initialized: true,
    capabilities: ["define", "send", "state", "can", "history", "restart", "snapshot"],
    evidence: {
      defined: machine !== null,
      current: machine?.current ?? null,
      transitions: machine?.transitions.size ?? 0,
      historyLen: machine?.history.length ?? 0,
      notes: [
        "real deterministic FSM: guarded transitions + audit history (governed workflow tier)",
        "NOT a distributed orchestrator / BPMN / saga engine; NOT production-GO (governedProductionGo=false)",
      ],
    },
    __meta: { reconstructed: false, governedProductionGo: false },
  };
}
