/*
 * @maataa/runtime-hkd-registry
 * Scaffold-only. Every method returns fail-closed not_implemented results.
 * Spec: doc/RUNTIME_FEDERATION_2026-05-28.md §4.3
 */

const RUNTIME = "runtime-hkd-registry";
const VERSION = "0.1.0-alpha.1";

// ---- Result envelope ------------------------------------------------------
export type Ok<T>  = { isOk: true;  data: T;    error: null };
export type Err    = { isOk: false; data: null; error: { code: string; detail: string } };
export type Result<T> = Ok<T> | Err;

const notImplemented = <T>(method: string): Result<T> => ({
  isOk: false,
  data: null,
  error: { code: "not_implemented", detail: `${RUNTIME}.${method}: scaffold-only` }
});

// ---- Contract types -------------------------------------------------------
export type ArtifactSpec = {
  name: string;
  kind: "runtime" | "app" | "capsule" | "evidence" | "trust-root" | "policy";
  version: string;
  payloadHash: string;
  registrant: string;
};

export type Artifact = ArtifactSpec & {
  id: string;
  signature: string;
  prevHash: string | null;
  ts: number;
  revoked: boolean;
};

export type TrustChain = "enforced" | "advisory" | "unverified";

// ---- Facade ---------------------------------------------------------------
export async function register(
  _spec: ArtifactSpec
): Promise<Result<{ id: string; version: string; signature: string }>> {
  return notImplemented("register");
}

export async function resolve(_name: string, _version?: string): Promise<Result<Artifact>> {
  return notImplemented("resolve");
}

export async function list(_filter?: { kind?: ArtifactSpec["kind"] }): Promise<Result<Artifact[]>> {
  return notImplemented("list");
}

export async function pin(_id: string, _version: string): Promise<Result<{ pinId: string }>> {
  return notImplemented("pin");
}

export async function verify(_id: string): Promise<Result<{ signatureValid: boolean; trustChain: TrustChain }>> {
  return notImplemented("verify");
}

// ---- Observable surface ---------------------------------------------------
export type HealthReport = {
  runtime: string;
  version: string;
  status: "scaffold" | "degraded" | "ready";
  initialized: boolean;
  capabilities: string[];
  evidence: {
    pendingOps: number;
    lastEventTs: number | null;
    artifactCount: number;
    pinCount: number;
    revocationCount: number;
    trustState: TrustChain | "unresolved";
    notes: string[];
  };
  __meta: { reconstructed: boolean; governedProductionGo: false };
};

export function health(): HealthReport {
  return {
    runtime: RUNTIME,
    version: VERSION,
    status: "scaffold",
    initialized: false,
    capabilities: [],
    evidence: {
      pendingOps: 0,
      lastEventTs: null,
      artifactCount: 0,
      pinCount: 0,
      revocationCount: 0,
      trustState: "unresolved",
      notes: [
        "scaffold-only: no ledger, no signatures, no policy",
        "depends on hemant-core for time + HSTS trust gates"
      ]
    },
    __meta: { reconstructed: false, governedProductionGo: false }
  };
}
