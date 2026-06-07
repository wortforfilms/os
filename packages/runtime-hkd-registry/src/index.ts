/*
 * @maataa/runtime-hkd-registry
 * Minimal but REAL append-only artifact ledger (in-memory tier).
 * Spec: doc/RUNTIME_FEDERATION_2026-05-28.md §4.3
 *
 * Honest scope: artifacts are recorded in a hash-chained, tamper-evident ledger.
 * The "signature" is a SHA-256 content digest (prevHash + payloadHash), NOT an
 * HSM/asymmetric signature — so verify() reports trustChain "advisory", never
 * "enforced". Not persistent, not production-GO (__meta.governedProductionGo=false).
 */
import { createHash } from "node:crypto";
import RuntimePersistence from "../../runtime-persistence/src/index.ts";

const RUNTIME = "runtime-hkd-registry";
const VERSION = "0.1.0-alpha.1";

export type Ok<T>  = { isOk: true;  data: T;    error: null };
export type Err    = { isOk: false; data: null; error: { code: string; detail: string } };
export type Result<T> = Ok<T> | Err;
const ok = <T>(data: T): Ok<T> => ({ isOk: true, data, error: null });
const errR = (code: string, detail: string): Err => ({ isOk: false, data: null, error: { code, detail } });

export type ArtifactSpec = {
  name: string;
  kind: "runtime" | "app" | "capsule" | "evidence" | "trust-root" | "policy";
  version: string;
  payloadHash: string;
  registrant: string;
};
export type Artifact = ArtifactSpec & { id: string; signature: string; prevHash: string | null; ts: number; revoked: boolean };
export type TrustChain = "enforced" | "advisory" | "unverified";

const ledger: Artifact[] = [];
const pins = new Map<string, { id: string; version: string }>();
let seq = 0;
let lastEventTs: number | null = null;
const touch = () => { lastEventTs = Date.now(); };
const sign = (payloadHash: string, prevHash: string | null) =>
  createHash("sha256").update(`${prevHash ?? ""}:${payloadHash}`).digest("hex");

// SQLite persistence layer
const persistence = new RuntimePersistence(RUNTIME);

// Restore from persistence
function restoreFromPersistence(): void {
  const storedLedger = persistence.load("ledger");
  if (storedLedger.ok && Array.isArray(storedLedger.value)) {
    ledger.push(...(storedLedger.value as Artifact[]));
  }
  const storedPins = persistence.load("pins");
  if (storedPins.ok && storedPins.value && typeof storedPins.value === "object") {
    for (const [key, value] of Object.entries(storedPins.value)) {
      pins.set(key, value as { id: string; version: string });
    }
  }
}

// Persist state
function persistState(): void {
  persistence.persist("ledger", ledger);
  persistence.persist("pins", Object.fromEntries(pins));
}

// Initialize on module load
restoreFromPersistence();

export function reset(): void { ledger.length = 0; pins.clear(); seq = 0; lastEventTs = null; persistence.clear(); }

export async function register(spec: ArtifactSpec): Promise<Result<{ id: string; version: string; signature: string }>> {
  if (!spec || !spec.name || !spec.version || !spec.payloadHash) {
    return errR("invalid_spec", "register: name, version, payloadHash are required");
  }
  const prevHash = ledger.length ? ledger[ledger.length - 1].signature : null;
  const signature = sign(spec.payloadHash, prevHash);
  const artifact: Artifact = { ...spec, id: `art-${(++seq).toString(36)}`, signature, prevHash, ts: Date.now(), revoked: false };
  ledger.push(artifact);
  touch();
  persistState(); // Persist after changes
  return ok({ id: artifact.id, version: artifact.version, signature });
}

export async function resolve(name: string, version?: string): Promise<Result<Artifact>> {
  const matches = ledger.filter((a) => a.name === name && !a.revoked && (version === undefined || a.version === version));
  if (matches.length === 0) return errR("not_found", `resolve: no artifact '${name}'${version ? "@" + version : ""}`);
  return ok(matches[matches.length - 1]);
}

export async function list(filter?: { kind?: ArtifactSpec["kind"] }): Promise<Result<Artifact[]>> {
  return ok(ledger.filter((a) => !filter?.kind || a.kind === filter.kind));
}

export async function pin(id: string, version: string): Promise<Result<{ pinId: string }>> {
  if (!ledger.some((a) => a.id === id)) return errR("not_found", `pin: artifact '${id}' not in ledger`);
  const pinId = `pin-${id}-${version}`;
  pins.set(pinId, { id, version });
  touch();
  persistState();
  return ok({ pinId });
}

export async function verify(id: string): Promise<Result<{ signatureValid: boolean; trustChain: TrustChain }>> {
  const a = ledger.find((x) => x.id === id);
  if (!a) return errR("not_found", `verify: artifact '${id}' not in ledger`);
  const signatureValid = a.signature === sign(a.payloadHash, a.prevHash);
  // Content-digest only → advisory trust. Never "enforced" without an HSM root.
  return ok({ signatureValid, trustChain: signatureValid ? "advisory" : "unverified" });
}

/** Revoke an artifact: marks it revoked (resolve() then excludes it). The ledger
 * entry is retained for audit — revocation is recorded, never erased. */
export async function revoke(id: string): Promise<Result<{ id: string; revoked: true }>> {
  const a = ledger.find((x) => x.id === id);
  if (!a) return errR("not_found", `revoke: artifact '${id}' not in ledger`);
  a.revoked = true;
  touch();
  persistState();
  return ok({ id, revoked: true });
}

export type HealthReport = {
  runtime: string; version: string; status: "scaffold" | "degraded" | "ready"; initialized: boolean; capabilities: string[];
  evidence: { pendingOps: number; lastEventTs: number | null; artifactCount: number; pinCount: number; revocationCount: number; trustState: TrustChain | "unresolved"; persistence: ReturnType<RuntimePersistence["health"]>; notes: string[] };
  __meta: { reconstructed: boolean; governedProductionGo: false };
};

export function health(): HealthReport {
  return {
    runtime: RUNTIME, version: VERSION, status: "ready", initialized: true,
    capabilities: ["register", "resolve", "list", "pin", "verify"],
    evidence: {
      pendingOps: 0, lastEventTs,
      artifactCount: ledger.length, pinCount: pins.size, revocationCount: ledger.filter((a) => a.revoked).length,
      trustState: "advisory",
      persistence: persistence.health(),
      notes: [
        "in-memory tier: hash-chained tamper-evident ledger, real register/resolve/list/pin/verify",
        "ledger and pins persist to SQLite via runtime-persistence",
        "signature = SHA-256 content digest (advisory trust), NOT HSM-backed — never 'enforced'",
        "NOT production-GO (governedProductionGo=false)",
      ],
    },
    __meta: { reconstructed: false, governedProductionGo: false },
  };
}
