import { createRuntimeTarget } from "../../runtime-target-scaffold/src/index.ts";
export type { Result, RuntimeTargetDefinition, RuntimeTargetHealth, TargetOperation } from "../../runtime-target-scaffold/src/index.ts";

export const target = createRuntimeTarget({
  packageName: "@maataa/tlp-runtime",
  runtime: "tlp-runtime",
  title: "TLP Runtime",
  hkdUniverse: "runtime",
  hkdClaimId: "c-rt-tlp-active",
  sourceBoard: "hkd/runtime-universe.hkd",
  scope: "TLP target surface only. apps/tlp contains a local app scaffold; this package does not run production planning or film workflows.",
  intendedCapabilities: ["production planning", "schedule bridge", "accounting bridge", "vendor bridge"],
  blockers: ["runtime implementation missing", "no live production workflow evidence", "no payments or vendor integration", "productionReady=false"],
});
export const targetDefinition = target.definition;
export const inspect = target.inspect;
export const execute = target.execute;
export const health = target.health;
