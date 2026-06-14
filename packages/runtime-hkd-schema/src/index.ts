/*
 * @maataa/runtime-hkd-schema — runtime for the HKD capsule contract.
 *
 * Real, deterministic, fail-closed validation + a real hkd:// URI parser.
 * Enforces the mockup's stated capsule rule: "Every HKD must be either source-backed,
 * runtime-backed, or honestly marked blocked; no fake production readiness."
 * governedProductionGo stays false.
 */
import type { HKD, HKDUri, HKDStatus } from "./schema.ts";
export * from "./schema.ts";

const RUNTIME = "runtime-hkd-schema";
const VERSION = "0.1.0-alpha.1";

export type Ok<T> = { isOk: true; data: T; error: null };
export type Err = { isOk: false; data: null; error: { code: string; detail: string } };
export type Result<T> = Ok<T> | Err;
const ok = <T>(data: T): Ok<T> => ({ isOk: true, data, error: null });
const err = (code: string, detail: string): Err => ({ isOk: false, data: null, error: { code, detail } });

const STATUSES: HKDStatus[] = ["draft", "preview", "verified", "blocked"];

/** Parse an hkd:// URI. Fail-closed on wrong scheme / empty domain / empty path. */
export function parseHkdUri(uri: string): Result<HKDUri> {
  if (typeof uri !== "string" || uri.length === 0) return err("empty_uri", "parseHkdUri: uri required");
  const m = /^hkd:\/\/([^/]+)\/(.+)$/.exec(uri.trim());
  if (!m) return err("bad_uri", `parseHkdUri: '${uri}' is not hkd://<domain>/<path>`);
  const domain = m[1];
  const segments = m[2].split("/").filter((s) => s.length > 0);
  if (segments.length === 0) return err("empty_path", "parseHkdUri: path has no segments");
  return ok({ scheme: "hkd", domain, segments, path: segments.join("/") });
}

/** Build an hkd:// URI from parts. Fail-closed on empty parts. */
export function buildHkdUri(domain: string, segments: string[]): Result<string> {
  if (!domain) return err("empty_domain", "buildHkdUri: domain required");
  if (!Array.isArray(segments) || segments.length === 0 || segments.some((s) => !s)) {
    return err("empty_segments", "buildHkdUri: non-empty segments required");
  }
  return ok(`hkd://${domain}/${segments.join("/")}`);
}

/**
 * Validate an HKD capsule against the canonical schema. Returns structured field errors.
 * Fail-closed: anything not provably valid is reported, never silently accepted.
 */
export function validateHkd(input: unknown): Result<{ valid: true }> {
  const errors: string[] = [];
  const h = input as Partial<HKD>;
  if (!input || typeof input !== "object") return err("not_object", "validateHkd: capsule must be an object");

  for (const f of ["id", "uri", "title", "domain", "summary", "content"] as const) {
    if (typeof h[f] !== "string" || (h[f] as string).length === 0) errors.push(`field '${f}' must be a non-empty string`);
  }
  for (const f of ["assets", "evidence", "relations", "blockers"] as const) {
    if (!Array.isArray(h[f])) errors.push(`field '${f}' must be an array`);
  }
  if (typeof h.status !== "string" || !STATUSES.includes(h.status as HKDStatus)) {
    errors.push(`field 'status' must be one of ${STATUSES.join("|")}`);
  }
  if (typeof h.uri === "string" && h.uri.length > 0 && !parseHkdUri(h.uri).isOk) {
    errors.push(`field 'uri' is not a valid hkd:// URI`);
  }
  // Evidence record shape
  if (Array.isArray(h.evidence)) {
    h.evidence.forEach((e, i) => {
      if (!e || typeof (e as any).sourcePath !== "string" || !(e as any).sourcePath) errors.push(`evidence[${i}].sourcePath required`);
      const p = (e as any)?.provenance;
      if (!["source-proven", "operator-prompt", "unknown"].includes(p)) errors.push(`evidence[${i}].provenance invalid`);
    });
  }
  if (errors.length) return err("invalid_hkd", errors.join("; "));
  return ok({ valid: true });
}

/**
 * Enforce the capsule rule: a "verified" capsule MUST carry at least one source-proven
 * evidence record AND have zero open blockers. Otherwise it cannot be verified — fail-closed.
 * Returns the status the capsule is *entitled* to claim.
 */
export function entitledStatus(hkd: HKD): Result<{ claimed: HKDStatus; entitled: HKDStatus; reasons: string[] }> {
  const v = validateHkd(hkd);
  if (!v.isOk) return err("invalid_hkd", v.error.detail);
  const reasons: string[] = [];
  const sourceProven = hkd.evidence.some((e) => e.provenance === "source-proven");
  const hasBlockers = hkd.blockers.length > 0;
  let entitled: HKDStatus = hkd.status;
  if (hkd.status === "verified") {
    if (hasBlockers) { entitled = "blocked"; reasons.push("has open blockers → downgraded to blocked"); }
    else if (!sourceProven) { entitled = "preview"; reasons.push("no source-proven evidence → cannot be verified, downgraded to preview"); }
  }
  return ok({ claimed: hkd.status, entitled, reasons });
}

export type HealthReport = {
  runtime: string; version: string; status: "ready"; initialized: boolean; capabilities: string[];
  evidence: { statuses: HKDStatus[]; notes: string[] };
  __meta: { reconstructed: boolean; governedProductionGo: false };
};

export function health(): HealthReport {
  return {
    runtime: RUNTIME, version: VERSION, status: "ready", initialized: true,
    capabilities: ["parseHkdUri", "buildHkdUri", "validateHkd", "entitledStatus"],
    evidence: {
      statuses: STATUSES,
      notes: [
        "canonical HKD capsule schema + real hkd:// URI parser + fail-closed validation",
        "absorbed from operator vision-board mockups; mockup METRICS are fabricated and NOT included",
        "enforces capsule rule: verified requires source-proven evidence + zero blockers; NOT production-GO",
      ],
    },
    __meta: { reconstructed: true, governedProductionGo: false },
  };
}
