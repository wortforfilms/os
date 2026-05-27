import { lipi426Master } from "../data/lipi-426-master";

export function groupScriptsByWave() {
  return lipi426Master.reduce<Record<string, number>>((groups, script) => {
    const wave = script.wave ?? "UNSPECIFIED";
    groups[wave] = (groups[wave] ?? 0) + 1;
    return groups;
  }, {});
}
