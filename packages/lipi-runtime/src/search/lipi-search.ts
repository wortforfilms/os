import { lipi426Master } from "../data/lipi-426-master";

export function searchLipiScripts(query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return lipi426Master.filter((script) =>
    [script.id, script.isoCode, script.name, script.nativeName, script.family, script.region]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle)),
  );
}
