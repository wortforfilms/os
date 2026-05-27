import { scriptLineageGraph } from "../../../src/lineage/script-lineage-graph";

export function LineageGraph() {
  return (
    <ol>
      {scriptLineageGraph.map((edge) => (
        <li key={edge.id}>{edge.parentScriptId} -> {edge.childScriptId}: {edge.relationType}</li>
      ))}
    </ol>
  );
}
