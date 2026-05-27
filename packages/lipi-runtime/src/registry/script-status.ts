import { lipi426Master } from "../data/lipi-426-master";

export function summarizeScriptStatus() {
  return lipi426Master.reduce<Record<string, number>>((summary, script) => {
    summary[script.status] = (summary[script.status] ?? 0) + 1;
    return summary;
  }, {});
}
