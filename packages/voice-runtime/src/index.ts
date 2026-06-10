import { createRuntimeTarget } from "../../runtime-target-scaffold/src/index.ts";
export type { Result, RuntimeTargetDefinition, RuntimeTargetHealth, TargetOperation } from "../../runtime-target-scaffold/src/index.ts";

export const target = createRuntimeTarget({
  packageName: "@maataa/voice-runtime",
  runtime: "voice-runtime",
  title: "Voice Runtime",
  hkdUniverse: "runtime",
  hkdClaimId: "c-rt-voice-active",
  sourceBoard: "hkd/runtime-universe.hkd",
  scope: "Voice target surface only. No live speech recognition, synthesis, wake word, or audio IPC runtime is active.",
  intendedCapabilities: ["speech input", "speech output", "voice command routing", "audio provenance"],
  blockers: ["runtime implementation missing", "no voice model evidence", "no live audio path", "productionReady=false"],
});
export const targetDefinition = target.definition;
export const inspect = target.inspect;
export const execute = target.execute;
export const health = target.health;
