import type { RuntimeSnapshot } from "./types";

export const defaultRuntimeSnapshot: RuntimeSnapshot = {
  mode: "OFFLINE",
  health: "nominal",
  governanceState: "VALIDATED_PREVIEW",
  route: "/runtime-observatory",
  stats: [
    { label: "Theme Runtime", value: "Very strong", tone: "nominal" },
    { label: "Observability", value: "Strong", tone: "nominal" },
    { label: "Scientific Certification", value: "Blocked", tone: "degraded" },
  ],
};
