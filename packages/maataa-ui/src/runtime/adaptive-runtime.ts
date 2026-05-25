import type { RuntimeMode } from "../types";

export function resolveAdaptiveRuntime(prefersReducedMotion: boolean, offline = true): RuntimeMode {
  if (prefersReducedMotion) return "ACCESSIBILITY";
  return offline ? "OFFLINE" : "STANDARD";
}
