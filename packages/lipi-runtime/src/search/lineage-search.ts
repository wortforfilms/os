import { scriptLineageGraph } from "../lineage/script-lineage-graph";

export function searchLineage(query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return scriptLineageGraph.filter((edge) =>
    [edge.parentScriptId, edge.childScriptId, edge.relationType, edge.evidenceNote]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle)),
  );
}
