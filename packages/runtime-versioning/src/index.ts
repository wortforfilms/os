/*
 * @maataa/runtime-versioning
 * Minimal but REAL in-process versioning runtime (snapshot / history / diff / rollback).
 *
 * Honest scope: an append-only version log per key with content hashing, real
 * object diffs, and rollback (recorded as a new version, never destructive). This
 * is the in-process tier — NOT a distributed VCS and NOT the board's marketing
 * "v1.0 → v5.0 evolution pipeline". governedProductionGo stays false. Fail-closed.
 */
import { createHash } from "node:crypto";

const RUNTIME = "runtime-versioning";
const VERSION = "0.1.0-alpha.1";

export type Ok<T> = { isOk: true; data: T; error: null };
export type Err = { isOk: false; data: null; error: { code: string; detail: string } };
export type Result<T> = Ok<T> | Err;
const ok = <T>(data: T): Ok<T> => ({ isOk: true, data, error: null });
const err = (code: string, detail: string): Err => ({ isOk: false, data: null, error: { code, detail } });

export type Version = { version: number; value: unknown; hash: string; ts: number; note: string };
const store = new Map<string, Version[]>();
let lastEventTs: number | null = null;
const touch = () => { lastEventTs = Date.now(); };
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v ?? null)).digest("hex").slice(0, 16);

export function reset(): void { store.clear(); lastEventTs = null; }

/** (1) Snapshot a new version of a key (append-only). */
export function snapshot(key: string, value: unknown, note = ""): Result<{ version: number; hash: string }> {
  if (!key || typeof key !== "string") return err("invalid_key", "snapshot: key required");
  const log = store.get(key) ?? [];
  const version = log.length + 1;
  const entry: Version = { version, value, hash: hash(value), ts: Date.now(), note };
  log.push(entry);
  store.set(key, log);
  touch();
  return ok({ version, hash: entry.hash });
}

/** (2) Full version history of a key (newest last). */
export function history(key: string): Result<{ versions: Array<{ version: number; hash: string; ts: number; note: string }> }> {
  const log = store.get(key);
  if (!log) return err("unknown_key", `history: key '${key}' has no versions`);
  return ok({ versions: log.map(({ version, hash: h, ts, note }) => ({ version, hash: h, ts, note })) });
}

/** (3) Get the value at a version (latest if omitted). Fail-closed on bad version. */
export function get(key: string, version?: number): Result<{ version: number; value: unknown }> {
  const log = store.get(key);
  if (!log || log.length === 0) return err("unknown_key", `get: key '${key}' has no versions`);
  const v = version ?? log.length;
  const entry = log.find((e) => e.version === v);
  if (!entry) return err("unknown_version", `get: key '${key}' has no version ${v}`);
  return ok({ version: entry.version, value: entry.value });
}

/** (4) Diff two versions: added / removed / changed top-level keys (objects), or a
 * scalar change. Real structural comparison. */
export function diff(key: string, v1: number, v2: number): Result<{ added: string[]; removed: string[]; changed: string[]; scalarChanged: boolean }> {
  const a = get(key, v1); const b = get(key, v2);
  if (!a.isOk) return a as Err;
  if (!b.isOk) return b as Err;
  const x = a.data.value, y = b.data.value;
  const obj = (z: unknown): z is Record<string, unknown> => !!z && typeof z === "object" && !Array.isArray(z);
  if (obj(x) && obj(y)) {
    const kx = Object.keys(x), ky = Object.keys(y);
    const added = ky.filter((k) => !kx.includes(k));
    const removed = kx.filter((k) => !ky.includes(k));
    const changed = kx.filter((k) => ky.includes(k) && JSON.stringify(x[k]) !== JSON.stringify(y[k]));
    return ok({ added, removed, changed, scalarChanged: false });
  }
  return ok({ added: [], removed: [], changed: [], scalarChanged: JSON.stringify(x) !== JSON.stringify(y) });
}

/** (5) Roll back to an earlier version — recorded as a NEW version (non-destructive). */
export function rollback(key: string, toVersion: number): Result<{ version: number; restoredFrom: number }> {
  const target = get(key, toVersion);
  if (!target.isOk) return target as Err;
  const snap = snapshot(key, target.data.value, `rollback to v${toVersion}`);
  if (!snap.isOk) return snap as Err;
  return ok({ version: snap.data.version, restoredFrom: toVersion });
}

export type HealthReport = {
  runtime: string; version: string; status: "scaffold" | "degraded" | "ready"; initialized: boolean; capabilities: string[];
  evidence: { pendingOps: number; lastEventTs: number | null; keys: number; totalVersions: number; notes: string[] };
  __meta: { reconstructed: boolean; governedProductionGo: false };
};

export function health(): HealthReport {
  let totalVersions = 0;
  for (const log of store.values()) totalVersions += log.length;
  return {
    runtime: RUNTIME, version: VERSION, status: "ready", initialized: true,
    capabilities: ["snapshot", "history", "get", "diff", "rollback"],
    evidence: {
      pendingOps: 0, lastEventTs, keys: store.size, totalVersions,
      notes: [
        "in-process tier: append-only versioned KV with content hashing, real diffs, non-destructive rollback",
        "NOT a distributed VCS / NOT the board's 'v1.0 → v5.0' marketing pipeline",
        "NOT production-GO (governedProductionGo=false)",
      ],
    },
    __meta: { reconstructed: false, governedProductionGo: false },
  };
}
