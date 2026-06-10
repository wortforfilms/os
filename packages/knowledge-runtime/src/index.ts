import { createRuntimeTarget } from "../../runtime-target-scaffold/src/index.ts";
export type { Result, RuntimeTargetDefinition, RuntimeTargetHealth, TargetOperation } from "../../runtime-target-scaffold/src/index.ts";

export const target = createRuntimeTarget({
  packageName: "@maataa/knowledge-runtime",
  runtime: "knowledge-runtime",
  title: "Knowledge Runtime",
  hkdUniverse: "runtime",
  hkdClaimId: "c-rt-knowledge-active",
  sourceBoard: "hkd/runtime-universe.hkd",
  scope: "Name-match target for the HKD board. Real knowledge primitives remain in @maataa/kbs-runtime and kbs-graph; this package is not an active bridge.",
  intendedCapabilities: ["knowledge facade", "KBS bridge", "HKD-to-KG routing", "query governance"],
  blockers: ["runtime bridge implementation missing", "no active service process", "no production query evidence", "productionReady=false"],
});
export const targetDefinition = target.definition;
export const inspect = target.inspect;
export const execute = target.execute;
export const health = target.health;
