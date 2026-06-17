/*
 * @maataa/runtime-security
 * Minimal but REAL end-to-end secure-action pipeline (in-memory tier).
 *
 * Proves the workflow-universe security flow as ONE executable path:
 *   User Action → Auth → Permission → Policy → Encrypted Processing
 *               → Secure Storage → Audit Log
 *
 * PHKD posture — honest scope:
 *  - FAIL CLOSED: every stage can deny; a denial is itself audited, and the
 *    pipeline never proceeds past a failed stage.
 *  - Encryption is real AES-256-GCM (node:crypto). Storage holds CIPHERTEXT ONLY
 *    (iv + ciphertext + auth tag) — plaintext never persists. Wrong key fails.
 *  - The audit log is append-only and hash-chained; verifyAudit() detects tamper.
 *  - This is the request-scoped enforcement POINT. The canonical policy authority
 *    is @maataa/runtime-governance; this runtime does not claim that authority.
 *  - In-memory only. No network egress, no production-GO.
 *    __meta.governedProductionGo = false.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

const RUNTIME = "runtime-security";
const VERSION = "0.1.0-alpha.1";

export type Ok<T> = { isOk: true; data: T; error: null };
export type Err = { isOk: false; data: null; error: { code: string; detail: string; stage: Stage } };
export type Result<T> = Ok<T> | Err;
const ok = <T>(data: T): Ok<T> => ({ isOk: true, data, error: null });
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export type Stage =
  | "user-action"
  | "auth"
  | "permission"
  | "policy"
  | "encrypted-processing"
  | "secure-storage"
  | "audit-log";

// ---- State (in-memory, resettable) ------------------------------------------
type Session = { token: string; userId: string; role: string; exp: number };
type StoredRecord = { recordId: string; alg: "aes-256-gcm"; iv: string; ciphertext: string; tag: string; ts: number };
type AuditEvent = {
  seq: number;
  ts: number;
  actor: string | null;
  action: string;
  decision: "allow" | "deny";
  stage: Stage;
  recordId: string | null;
  detail: string;
  prevHash: string | null;
  hash: string;
};

const sessions = new Map<string, Session>();
const store = new Map<string, StoredRecord>();
const audit: AuditEvent[] = [];
let seq = 0;

// Declarative role → allowed actions (request-scoped permission set).
const ROLE_PERMISSIONS: Record<string, Set<string>> = {
  custodian: new Set(["write-evidence", "read-evidence", "delete-evidence"]),
  reviewer: new Set(["read-evidence"]),
  guest: new Set([]),
};

// Declarative request-scoped policies (fail closed). Each returns a violation string or null.
const POLICIES: Array<{ name: string; check: (action: string, payload: Record<string, unknown>) => string | null }> = [
  {
    name: "no-forbidden-classification",
    check: (_a, p) => (p.classification === "forbidden" ? "payload classification is forbidden" : null),
  },
  {
    name: "payload-required",
    check: (_a, p) => (p && typeof p === "object" && Object.keys(p).length > 0 ? null : "payload must be a non-empty object"),
  },
];

const now = () => Date.now();

function appendAudit(ev: Omit<AuditEvent, "seq" | "hash" | "prevHash">): AuditEvent {
  const prevHash = audit.length ? audit[audit.length - 1].hash : null;
  const seqN = ++seq;
  const base = { ...ev, seq: seqN, prevHash };
  const hash = sha(JSON.stringify(base));
  const full: AuditEvent = { ...base, hash };
  audit.push(full);
  return full;
}

const deny = (stage: Stage, code: string, detail: string, actor: string | null, action: string): Err => {
  appendAudit({ ts: now(), actor, action, decision: "deny", stage, recordId: null, detail });
  return { isOk: false, data: null, error: { code, detail, stage } };
};

// ---- Public API -------------------------------------------------------------

export function reset(): void {
  sessions.clear();
  store.clear();
  audit.length = 0;
  seq = 0;
}

/** Issue a session (the "Auth" subject). 15-minute expiry. */
export function createSession(userId: string, role: string): Result<{ token: string }> {
  const token = randomBytes(24).toString("hex");
  sessions.set(token, { token, userId, role, exp: now() + 15 * 60_000 });
  return ok({ token });
}

export type SecureActionInput = {
  token: string;
  action: string;
  payload: Record<string, unknown>;
  key: Buffer; // 32-byte AES key supplied by the caller (never stored)
};

export type SecureActionResult = {
  decision: "allow";
  recordId: string;
  actor: string;
  role: string;
  stages: Stage[];
  auditSeq: number;
  auditHash: string;
};

/** The full fail-closed pipeline. Returns allow + trace, or a denial Err (audited). */
export function processSecureAction(input: SecureActionInput): Result<SecureActionResult> {
  const stages: Stage[] = [];

  // 1) USER ACTION — validate the request shape.
  if (!input || typeof input.action !== "string" || !input.action) return deny("user-action", "E_BAD_ACTION", "action is required", null, String(input?.action ?? ""));
  if (!(input.key instanceof Buffer) || input.key.length !== 32) return deny("user-action", "E_BAD_KEY", "a 32-byte key is required", null, input.action);
  stages.push("user-action");

  // 2) AUTH — validate session.
  const sess = sessions.get(input.token);
  if (!sess) return deny("auth", "E_NO_SESSION", "invalid or unknown session token", null, input.action);
  if (sess.exp < now()) { sessions.delete(input.token); return deny("auth", "E_SESSION_EXPIRED", "session expired", sess.userId, input.action); }
  stages.push("auth");

  // 3) PERMISSION — role must allow the action.
  const perms = ROLE_PERMISSIONS[sess.role] ?? new Set<string>();
  if (!perms.has(input.action)) return deny("permission", "E_FORBIDDEN", `role '${sess.role}' may not '${input.action}'`, sess.userId, input.action);
  stages.push("permission");

  // 4) POLICY — declarative request-scoped policies, fail closed.
  for (const pol of POLICIES) {
    const violation = pol.check(input.action, input.payload);
    if (violation) return deny("policy", "E_POLICY", `${pol.name}: ${violation}`, sess.userId, input.action);
  }
  stages.push("policy");

  // 5) ENCRYPTED PROCESSING — AES-256-GCM. Plaintext stays in memory only here.
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", input.key, iv);
  const plaintext = Buffer.from(JSON.stringify(input.payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  stages.push("encrypted-processing");

  // 6) SECURE STORAGE — persist CIPHERTEXT ONLY.
  const recordId = `rec_${sha(`${sess.userId}:${input.action}:${iv.toString("hex")}`).slice(0, 16)}`;
  store.set(recordId, { recordId, alg: "aes-256-gcm", iv: iv.toString("hex"), ciphertext: ciphertext.toString("hex"), tag: tag.toString("hex"), ts: now() });
  stages.push("secure-storage");

  // 7) AUDIT LOG — append-only, hash-chained.
  const ev = appendAudit({ ts: now(), actor: sess.userId, action: input.action, decision: "allow", stage: "audit-log", recordId, detail: `stored ${ciphertext.length}B ciphertext` });
  stages.push("audit-log");

  return ok({ decision: "allow", recordId, actor: sess.userId, role: sess.role, stages, auditSeq: ev.seq, auditHash: ev.hash });
}

/** Retrieve + decrypt. Wrong key throws an auth-tag error => fails closed. */
export function retrieve(recordId: string, key: Buffer): Result<Record<string, unknown>> {
  const rec = store.get(recordId);
  if (!rec) return { isOk: false, data: null, error: { code: "E_NO_RECORD", detail: "no such record", stage: "secure-storage" } };
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(rec.iv, "hex"));
    decipher.setAuthTag(Buffer.from(rec.tag, "hex"));
    const plain = Buffer.concat([decipher.update(Buffer.from(rec.ciphertext, "hex")), decipher.final()]);
    return ok(JSON.parse(plain.toString("utf8")));
  } catch (err) {
    return { isOk: false, data: null, error: { code: "E_DECRYPT", detail: (err as Error).message, stage: "encrypted-processing" } };
  }
}

/** Proof that storage holds no plaintext: returns the raw stored record. */
export function rawStored(recordId: string): StoredRecord | null {
  return store.get(recordId) ?? null;
}

export function getAudit(): AuditEvent[] {
  return audit.map((e) => ({ ...e }));
}

/** Recompute the audit hash chain; detect any tamper. */
export function verifyAudit(): Result<{ events: number; chainOk: true }> {
  let prev: string | null = null;
  for (const e of audit) {
    const { hash, ...base } = e;
    if (base.prevHash !== prev) return { isOk: false, data: null, error: { code: "E_AUDIT_CHAIN", detail: `seq ${e.seq} prevHash mismatch`, stage: "audit-log" } };
    if (sha(JSON.stringify(base)) !== hash) return { isOk: false, data: null, error: { code: "E_AUDIT_TAMPER", detail: `seq ${e.seq} hash mismatch`, stage: "audit-log" } };
    prev = hash;
  }
  return ok({ events: audit.length, chainOk: true });
}

export function health() {
  const v = verifyAudit();
  return {
    runtime: RUNTIME,
    version: VERSION,
    status: v.isOk ? "ready" : "degraded",
    sessions: sessions.size,
    records: store.size,
    auditEvents: audit.length,
    governedProductionGo: false,
  };
}

/** Constant-time helper exposed for callers comparing secrets. */
export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export const STAGE_ORDER: Stage[] = ["user-action", "auth", "permission", "policy", "encrypted-processing", "secure-storage", "audit-log"];

export default { reset, createSession, processSecureAction, retrieve, rawStored, getAudit, verifyAudit, health, STAGE_ORDER };
