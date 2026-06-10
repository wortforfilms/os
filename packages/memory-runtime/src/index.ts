import { createRuntimeTarget } from "../../runtime-target-scaffold/src/index.ts";
export type { Result, RuntimeTargetDefinition, RuntimeTargetHealth, TargetOperation } from "../../runtime-target-scaffold/src/index.ts";

export const target = createRuntimeTarget({
  packageName: "@maataa/memory-runtime",
  runtime: "memory-runtime",
  title: "Memory Runtime",
  hkdUniverse: "runtime",
  hkdClaimId: "c-rt-memory-active",
  sourceBoard: "hkd/runtime-universe.hkd",
  scope: "Memory target surface only. No long-term memory vault, vector memory, user memory, or recall runtime is active.",
  intendedCapabilities: ["memory records", "recall policy", "forgetting policy", "provenance-aware storage"],
  blockers: ["runtime implementation missing", "no memory store evidence", "no privacy policy enforcement", "productionReady=false"],
});
export const targetDefinition = target.definition;
export const inspect = target.inspect;
export const execute = target.execute;
export const health = target.health;
