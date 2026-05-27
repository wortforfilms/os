import { readFileSync, writeFileSync } from "node:fs";

const registry = JSON.parse(readFileSync("packages/lipi-runtime/release/evidence/lipi-registry-status.json", "utf8"));
const amirpur = JSON.parse(readFileSync("packages/lipi-runtime/release/evidence/lipi-amirpur-readiness.json", "utf8"));
writeFileSync(
  "packages/lipi-runtime/release/evidence/lipi-evidence-bundle.json",
  `${JSON.stringify({ registry, amirpur, productionReady: false }, null, 2)}\n`,
);
console.log("LIPI_EVIDENCE_BUNDLE=EXPORTED");
