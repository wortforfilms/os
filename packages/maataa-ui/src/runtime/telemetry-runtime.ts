import type { RuntimeStat } from "../types";

export function summarizeTelemetry(stats: RuntimeStat[]): string {
  return stats.map((stat) => `${stat.label}:${stat.value}`).join("|");
}
