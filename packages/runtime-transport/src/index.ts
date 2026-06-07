/*
 * @maataa/runtime-transport
 * Deterministic in-process transport contract between runtimes.
 *
 * Honest scope: local handler registry + ACL + timeout/fallback + ledger. This
 * is a real runtime-to-runtime call facade, not a network bus and not
 * production-GO (__meta.governedProductionGo=false).
 */
import { createHash } from "node:crypto";

const RUNTIME = "runtime-transport";
const VERSION = "0.1.0-alpha.1";

export type Ok<T>  = { isOk: true;  data: T;    error: null };
export type Err    = { isOk: false; data: null; error: { code: string; detail: string } };
export type Result<T> = Ok<T> | Err;

const ok = <T>(data: T): Ok<T> => ({ isOk: true, data, error: null });
const err = (code: string, detail: string): Err => ({ isOk: false, data: null, error: { code, detail } });

export type RequestPayload = { method: string; args?: unknown[] };
export type ResponsePayload = { result?: unknown; error?: { code: string; detail: string } };
export type FallbackStrategy = "cached" | "stale-ok" | "fail-fast";
export type RuntimeHandler = (...args: unknown[]) => unknown | Promise<unknown>;
export type RuntimeHandlers = Record<string, RuntimeHandler>;

export type TransportRequest = {
  from: string;
  to: string;
  requestId?: string;
  method: string;
  payload?: RequestPayload;
  timeoutMs?: number;
  fallback?: FallbackStrategy;
  ts?: number;
};

export type TransportResponse = {
  requestId: string;
  fromRuntime: string;
  toRuntime: string;
  method: string;
  decision: "allowed" | "blocked" | "fallback";
  response?: ResponsePayload;
  error?: { code: string; detail: string };
  latencyMs: number;
  ts: number;
};

type LedgerEntry = { request: Required<Pick<TransportRequest, "from" | "to" | "method">> & TransportRequest; response?: TransportResponse };
type AclRule = { toRuntime: string; methods: Set<string> };

const ledger: LedgerEntry[] = [];
const responseCache = new Map<string, TransportResponse>();
const runtimes = new Map<string, RuntimeHandlers>();
const acl = new Map<string, AclRule[]>();
let seq = 0;
let lastEventTs: number | null = null;
const touch = () => { lastEventTs = Date.now(); };

const stableJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`)
    .join(",")}}`;
};

const digest = (value: unknown) => createHash("sha256").update(stableJson(value)).digest("hex").slice(0, 16);
const cacheKey = (req: TransportRequest) => `${req.from}->${req.to}:${req.method}:${digest(req.payload?.args ?? [])}`;

export function reset(): void {
  ledger.length = 0;
  responseCache.clear();
  runtimes.clear();
  acl.clear();
  seq = 0;
  lastEventTs = null;
}

export function registerRuntime(runtime: string, handlers: RuntimeHandlers): Result<true> {
  if (!runtime || typeof runtime !== "string") return err("invalid_runtime", "registerRuntime: runtime required");
  if (!handlers || typeof handlers !== "object" || Object.keys(handlers).length === 0) {
    return err("invalid_handlers", "registerRuntime: at least one handler required");
  }
  for (const [method, handler] of Object.entries(handlers)) {
    if (!method || typeof handler !== "function") return err("invalid_handlers", `registerRuntime: handler '${method}' must be a function`);
  }
  runtimes.set(runtime, { ...handlers });
  touch();
  return ok(true);
}

/** Define access control: fromRuntime may call toRuntime, optionally limited to methods. */
export function defineAcl(fromRuntime: string, toRuntime: string, methods: string[] = ["*"]): Result<true> {
  if (!fromRuntime || !toRuntime) {
    return err("invalid_acl", "defineAcl: fromRuntime and toRuntime required");
  }
  if (!Array.isArray(methods) || methods.length === 0 || methods.some((m) => !m || typeof m !== "string")) {
    return err("invalid_acl", "defineAcl: methods must be a non-empty string array");
  }
  const rules = acl.get(fromRuntime) ?? [];
  rules.push({ toRuntime, methods: new Set(methods) });
  acl.set(fromRuntime, rules);
  touch();
  return ok(true);
}

export function isAllowedByAcl(from: string, to: string, method = "*"): boolean {
  const rules = acl.get(from) ?? [];
  return rules.some((rule) => rule.toRuntime === to && (rule.methods.has("*") || rule.methods.has(method)));
}

async function withTimeout(handler: RuntimeHandler, args: unknown[], timeoutMs: number): Promise<unknown> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      Promise.resolve().then(() => handler(...args)),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`request exceeded ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function request(req: TransportRequest): Promise<Result<TransportResponse>> {
  const started = Date.now();
  if (!req || !req.from || !req.to || !req.method) {
    return err("invalid_request", "request: from, to, and method are required");
  }

  const normalized = {
    ...req,
    requestId: req.requestId || `req-${(++seq).toString(36)}-${digest({ from: req.from, to: req.to, method: req.method, args: req.payload?.args ?? [] })}`,
    payload: req.payload ?? { method: req.method, args: [] },
    ts: req.ts ?? Date.now(),
  };

  const blocked = (code: string, detail: string): TransportResponse => ({
    requestId: normalized.requestId,
    fromRuntime: normalized.from,
    toRuntime: normalized.to,
    method: normalized.method,
    decision: "blocked",
    error: { code, detail },
    latencyMs: Date.now() - started,
    ts: Date.now(),
  });

  if (!isAllowedByAcl(normalized.from, normalized.to, normalized.method)) {
    const response = blocked("acl_violation", `${normalized.from} not allowed to call ${normalized.to}.${normalized.method}`);
    ledger.push({ request: normalized, response });
    touch();
    return ok(response);
  }

  const target = runtimes.get(normalized.to);
  if (!target) {
    const response = blocked("runtime_unregistered", `${normalized.to} has no registered handlers`);
    ledger.push({ request: normalized, response });
    touch();
    return ok(response);
  }

  const handler = target[normalized.method];
  if (!handler) {
    const response = blocked("method_unregistered", `${normalized.to}.${normalized.method} is not registered`);
    ledger.push({ request: normalized, response });
    touch();
    return ok(response);
  }

  const key = cacheKey(normalized);
  try {
    const result = await withTimeout(handler, normalized.payload.args ?? [], normalized.timeoutMs ?? 5000);
    const response: TransportResponse = {
      requestId: normalized.requestId,
      fromRuntime: normalized.from,
      toRuntime: normalized.to,
      method: normalized.method,
      decision: "allowed",
      response: { result },
      latencyMs: Date.now() - started,
      ts: Date.now(),
    };
    responseCache.set(key, response);
    ledger.push({ request: normalized, response });
    touch();
    return ok(response);
  } catch (error) {
    const cached = responseCache.get(key);
    const message = error instanceof Error ? error.message : String(error);
    const canUseCache = (normalized.fallback === "cached" || normalized.fallback === "stale-ok") && cached;
    const response: TransportResponse = canUseCache
      ? {
          ...cached,
          requestId: normalized.requestId,
          decision: "fallback",
          latencyMs: Date.now() - started,
          ts: Date.now(),
        }
      : {
          requestId: normalized.requestId,
          fromRuntime: normalized.from,
          toRuntime: normalized.to,
          method: normalized.method,
          decision: normalized.fallback === "fail-fast" ? "blocked" : "fallback",
          error: { code: "transport_error", detail: message },
          latencyMs: Date.now() - started,
          ts: Date.now(),
        };
    ledger.push({ request: normalized, response });
    touch();
    return ok(response);
  }
}

export function ledgerSnapshot(): LedgerEntry[] {
  return [...ledger];
}

export type HealthReport = {
  runtime: string;
  version: string;
  status: "scaffold" | "degraded" | "ready";
  initialized: boolean;
  capabilities: string[];
  evidence: {
    pendingOps: number;
    lastEventTs: number | null;
    aclRules: number;
    registeredRuntimes: number;
    registeredMethods: number;
    ledgerEntries: number;
    cachedResponses: number;
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
    capabilities: ["registerRuntime", "defineAcl", "isAllowedByAcl", "request", "ledgerSnapshot"],
    evidence: {
      pendingOps: 0,
      lastEventTs,
      aclRules: [...acl.values()].reduce((count, rules) => count + rules.length, 0),
      registeredRuntimes: runtimes.size,
      registeredMethods: [...runtimes.values()].reduce((count, handlers) => count + Object.keys(handlers).length, 0),
      ledgerEntries: ledger.length,
      cachedResponses: responseCache.size,
      notes: [
        "deterministic in-process transport: handler registry + ACL + timeout/fallback + ledger",
        "cached/stale-ok fallback only uses prior successful responses for the same call signature",
        "NOT production-GO (governedProductionGo=false)",
      ],
    },
    __meta: { reconstructed: false, governedProductionGo: false },
  };
}
