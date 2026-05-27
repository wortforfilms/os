import { copyFileSync } from "node:fs";

copyFileSync(
  "packages/lipi-runtime/release/evidence/lipi-lineage-graph.json",
  "packages/lipi-runtime/release/evidence/lipi-lineage-graph.generated.json",
);
console.log("LIPI_LINEAGE_GRAPH=EXPORTED");
