const VERSION = "0.1.0-alpha.1";

export type Ok<T> = { isOk: true; data: T; error: null };
export type Err = { isOk: false; data: null; error: { code: string; detail: string } };
export type Result<T> = Ok<T> | Err;

export type RuntimeTargetDefinition = {
  packageName: string;
  runtime: string;
  title: string;
  hkdUniverse: string;
  hkdClaimId?: string;
  sourceBoard?: string;
  scope: string;
  intendedCapabilities: string[];
  blockers: string[];
};

export type TargetOperation = {
  type: string;
  payload?: unknown;
};

export type RuntimeTargetHealth = {
  runtime: string;
  packageName: string;
  version: string;
  status: "scaffold";
  initialized: false;
  capabilities: string[];
  evidence: {
    targetExists: true;
    implementation: "scaffold-only";
    liveDeployment: false;
    productionReady: false;
    runtimeMetrics: null;
    hkdUniverse: string;
    hkdClaimId: string | null;
    blockers: string[];
    notes: string[];
  };
  __meta: {
    reconstructed: false;
    governedProductionGo: false;
    productionReady: false;
    liveDeployment: false;
    fakeMetrics: false;
  };
};

const ok = <T>(data: T): Ok<T> => ({ isOk: true, data, error: null });
const err = (code: string, detail: string): Err => ({ isOk: false, data: null, error: { code, detail } });

export function createRuntimeTarget(definition: RuntimeTargetDefinition) {
  const inspect = (): Result<RuntimeTargetDefinition> => ok({ ...definition, blockers: [...definition.blockers], intendedCapabilities: [...definition.intendedCapabilities] });

  const execute = (operation: TargetOperation): Result<never> => {
    if (!operation || typeof operation.type !== "string" || operation.type.trim() === "") {
      return err("invalid_operation", `${definition.runtime}: operation.type is required`);
    }
    return err("not_implemented", `${definition.runtime}: target package exists, but runtime behavior is scaffold-only and intentionally fail-closed`);
  };

  const health = (): RuntimeTargetHealth => ({
    runtime: definition.runtime,
    packageName: definition.packageName,
    version: VERSION,
    status: "scaffold",
    initialized: false,
    capabilities: ["inspect", "health", "execute"],
    evidence: {
      targetExists: true,
      implementation: "scaffold-only",
      liveDeployment: false,
      productionReady: false,
      runtimeMetrics: null,
      hkdUniverse: definition.hkdUniverse,
      hkdClaimId: definition.hkdClaimId ?? null,
      blockers: [...definition.blockers],
      notes: [
        "Target package exists so HKD package-name blockers can move off 'missing on disk'.",
        "No runtime behavior, live deployment, hardware trust, user metrics, or production readiness is claimed.",
        "execute() fails closed with not_implemented until a real implementation and evidence land.",
      ],
    },
    __meta: {
      reconstructed: false,
      governedProductionGo: false,
      productionReady: false,
      liveDeployment: false,
      fakeMetrics: false,
    },
  });

  return {
    definition,
    inspect,
    execute,
    health,
  };
}
