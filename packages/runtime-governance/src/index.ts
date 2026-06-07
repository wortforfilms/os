/*
 * @maataa/runtime-governance
 * Minimal but REAL policy enforcement engine (in-memory tier).
 *
 * This is the runtime that runtime-mission lacked: it actually DECIDES
 * allow/block from declarative policies and keeps a tamper-evident, rollbackable
 * audit trail. Honest scope: in-memory, declarative policies only. It does NOT
 * replace the hardware-rooted release-authority gate and does NOT claim
 * production-GO (__meta.governedProductionGo=false).
 */
import { createHash } from "node:crypto";
import RuntimePersistence from "../../runtime-persistence/src/index.ts";

const RUNTIME = "runtime-governance";
const VERSION = "0.1.0-alpha.1";

export type Ok<T>  = { isOk: true;  data: T;    error: null };
export type Err    = { isOk: false; data: null; error: { code: string; detail: string } };
export type Result<T> = Ok<T> | Err;
const ok = <T>(data: T): Ok<T> => ({ isOk: true, data, error: null });
const errR = (code: string, detail: string): Err => ({ isOk: false, data: null, error: { code, detail } });

export type Op = "eq" | "neq" | "gte" | "lte" | "truthy";
export type PolicySpec = { name: string; key: string; op: Op; value?: unknown; severity?: "block" | "warn" };
export type Policy = PolicySpec & { id: string; severity: "block" | "warn"; ts: number };
export type Decision = "allow" | "block";
export type Violation = { policyId: string; name: string; key: string; op: Op; expected: unknown; actual: unknown; severity: "block" | "warn" };
export type EnforcementRecord = { recordId: string; decision: Decision; ts: number; contextDigest: string; violations: Violation[]; prevHash: string | null; hash: string };

const policies = new Map<string, Policy>();
const auditLog: EnforcementRecord[] = [];
let seq = 0;
let lastEventTs: number | null = null;
const touch = () => { lastEventTs = Date.now(); };
const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v ?? null)).digest("hex").slice(0, 16);

// SQLite persistence layer
const persistence = new RuntimePersistence(RUNTIME);

// Restore policies and audit log from persistence
function restoreFromPersistence(): void {
  const storedPolicies = persistence.load("policies");
  if (storedPolicies.ok && Array.isArray(storedPolicies.value)) {
    for (const pol of storedPolicies.value as Policy[]) {
      if (pol.id) policies.set(pol.id, pol);
    }
  }
  const storedAudit = persistence.load("auditLog");
  if (storedAudit.ok && Array.isArray(storedAudit.value)) {
    auditLog.push(...storedAudit.value as EnforcementRecord[]);
  }
}

// Persist policies after changes
function persistPolicies(): void {
  persistence.persist("policies", Array.from(policies.values()));
}

// Persist audit log after new records
function persistAuditLog(): void {
  persistence.persist("auditLog", auditLog);
}

// Initialize on module load
restoreFromPersistence();

export function reset(): void { policies.clear(); auditLog.length = 0; seq = 0; lastEventTs = null; persistence.clear(); }

export function definePolicy(spec: PolicySpec): Result<{ policyId: string }> {
  if (!spec || !spec.name || !spec.key || !spec.op) {
    return errR("invalid_policy", "definePolicy: name, key, op required");
  }
  if (!["eq", "neq", "gte", "lte", "truthy"].includes(spec.op)) {
    return errR("invalid_policy", `definePolicy: unknown op '${spec.op}'`);
  }
  const id = `pol-${(++seq).toString(36)}`;
  policies.set(id, { ...spec, id, severity: spec.severity ?? "block", ts: Date.now() });
  touch();
  persistPolicies(); // Persist after changes
  return ok({ policyId: id });
}

function check(policy: Policy, ctx: Record<string, unknown>): boolean {
  const actual = ctx[policy.key];
  switch (policy.op) {
    case "eq": return actual === policy.value;
    case "neq": return actual !== policy.value;
    case "gte": return typeof actual === "number" && typeof policy.value === "number" && actual >= policy.value;
    case "lte": return typeof actual === "number" && typeof policy.value === "number" && actual <= policy.value;
    case "truthy": return Boolean(actual);
    default: return false;
  }
}

export function evaluate(ctx: Record<string, unknown>): Result<Violation[]> {
  if (!ctx || typeof ctx !== "object") return errR("invalid_context", "evaluate: context object required");
  const violations: Violation[] = [];
  for (const p of policies.values()) {
    if (!check(p, ctx)) {
      violations.push({ policyId: p.id, name: p.name, key: p.key, op: p.op, expected: p.value, actual: ctx[p.key], severity: p.severity });
    }
  }
  return ok(violations);
}

export function enforce(ctx: Record<string, unknown>): Result<EnforcementRecord> {
  const ev = evaluate(ctx);
  if (!ev.isOk) return ev as Err;
  // FAIL CLOSED: any block-severity violation → decision "block".
  const decision: Decision = ev.data.some((v) => v.severity === "block") ? "block" : "allow";
  const prevHash = auditLog.length ? auditLog[auditLog.length - 1].hash : null;
  const contextDigest = digest(ctx);
  const base = { recordId: `enf-${(++seq).toString(36)}`, decision, ts: Date.now(), contextDigest, violations: ev.data, prevHash };
  const hash = createHash("sha256").update(`${prevHash ?? ""}:${decision}:${contextDigest}:${ev.data.length}`).digest("hex");
  const record: EnforcementRecord = { ...base, hash };
  auditLog.push(record);
  touch();
  persistAuditLog(); // Persist after new enforcement record
  return ok(record);
}

export function audit(): Result<EnforcementRecord[]> {
  return ok([...auditLog]);
}

/** Roll back the last N enforcement records (operational reversal of the ledger tail). */
export function rollback(n = 1): Result<{ removed: number }> {
  if (!Number.isInteger(n) || n < 1) return errR("invalid_rollback", "rollback: n must be a positive integer");
  const removed = Math.min(n, auditLog.length);
  auditLog.splice(auditLog.length - removed, removed);
  touch();
  persistAuditLog();
  return ok({ removed });
}

export type HealthReport = {
  runtime: string; version: string; status: "scaffold" | "degraded" | "ready"; initialized: boolean; capabilities: string[];
  evidence: { pendingOps: number; lastEventTs: number | null; policyCount: number; enforcementCount: number; lastDecision: Decision | null; persistence: ReturnType<RuntimePersistence["health"]>; notes: string[] };
  __meta: { reconstructed: boolean; governedProductionGo: false };
};

export function health(): HealthReport {
  return {
    runtime: RUNTIME, version: VERSION, status: "ready", initialized: true,
    capabilities: ["definePolicy", "evaluate", "enforce", "audit", "rollback"],
    evidence: {
      pendingOps: 0, lastEventTs,
      policyCount: policies.size,
      enforcementCount: auditLog.length,
      lastDecision: auditLog.length ? auditLog[auditLog.length - 1].decision : null,
      persistence: persistence.health(),
      notes: [
        "real declarative policy evaluation + fail-closed enforce + hash-chained audit + rollback",
        "policies and audit log persist to SQLite via runtime-persistence",
        "does NOT replace the hardware-rooted release-authority gate; NOT production-GO (governedProductionGo=false)",
      ],
    },
    __meta: { reconstructed: false, governedProductionGo: false },
  };
}
