import { createRuntimeTarget } from "../../runtime-target-scaffold/src/index.ts";
export type { Result, RuntimeTargetDefinition, RuntimeTargetHealth, TargetOperation } from "../../runtime-target-scaffold/src/index.ts";

export const target = createRuntimeTarget({
  packageName: "@maataa/gesture-runtime",
  runtime: "gesture-runtime",
  title: "Gesture Runtime",
  hkdUniverse: "runtime",
  hkdClaimId: "c-rt-gesture-active",
  sourceBoard: "hkd/runtime-universe.hkd",
  scope: "Gesture target surface only. No camera, pose, hand-tracking, or action dispatch runtime is active.",
  intendedCapabilities: ["gesture recognition", "pose state", "input mapping", "confidence gating"],
  blockers: ["runtime implementation missing", "no sensor evidence", "no live input stream", "productionReady=false"],
});
export const targetDefinition = target.definition;
export const inspect = target.inspect;
export const execute = target.execute;
export const health = target.health;
