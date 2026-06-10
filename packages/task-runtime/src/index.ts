import { createRuntimeTarget } from "../../runtime-target-scaffold/src/index.ts";
export type { Result, RuntimeTargetDefinition, RuntimeTargetHealth, TargetOperation } from "../../runtime-target-scaffold/src/index.ts";

export const target = createRuntimeTarget({
  packageName: "@maataa/task-runtime",
  runtime: "task-runtime",
  title: "Task Runtime",
  hkdUniverse: "runtime",
  hkdClaimId: "c-rt-task-active",
  sourceBoard: "hkd/runtime-universe.hkd",
  scope: "Task target surface only. No distributed task queue, automation engine, or active workflow runner is active.",
  intendedCapabilities: ["task model", "assignment rules", "execution audit", "scheduler bridge"],
  blockers: ["runtime implementation missing", "no queue or worker evidence", "no automation safety gate", "productionReady=false"],
});
export const targetDefinition = target.definition;
export const inspect = target.inspect;
export const execute = target.execute;
export const health = target.health;
