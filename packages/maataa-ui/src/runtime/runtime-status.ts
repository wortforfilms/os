import type { RuntimeHealthMetric } from "../types/runtime";

export const runtimeHealthMetrics: RuntimeHealthMetric[] = [
  { id: "status", label: "Final status", value: "GOVERNED_PRODUCTION_NO_GO", status: "BLOCKED" },
  { id: "offline", label: "Offline interface", value: "enabled", status: "READY" },
  { id: "attestation", label: "Hardware attestation", value: "missing", status: "BLOCKED" },
  { id: "quorum", label: "Operator quorum", value: "unverified", status: "BLOCKED" },
];
