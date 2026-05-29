import { existsSync, readFileSync, writeFileSync } from "node:fs";

const requiredFiles = [
  "packages/visual-hkd-runtime/package.json",
  "packages/visual-hkd-runtime/src/index.ts",
  "packages/visual-hkd-runtime/src/image-loader.ts",
  "packages/visual-hkd-runtime/src/vision-extractor.ts",
  "packages/visual-hkd-runtime/src/panel-detector.ts",
  "packages/visual-hkd-runtime/src/text-extractor.ts",
  "packages/visual-hkd-runtime/src/icon-classifier.ts",
  "packages/visual-hkd-runtime/src/layout-parser.ts",
  "packages/visual-hkd-runtime/src/hkd-generator.ts",
  "packages/visual-hkd-runtime/src/graph-ingestor.ts",
  "packages/visual-hkd-runtime/src/runtime-generator.ts",
  "packages/visual-hkd-runtime/src/status-validator.ts",
  "release/evidence/visual-hkd-runtime.json",
  "docs/visual-hkd-runtime.md"
];

const evidencePath = "release/evidence/visual-hkd-runtime.json";
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`missing file: ${file}`);
}

if (evidence.package !== "@maataa/visual-hkd-runtime") failures.push("wrong package name");
if (evidence.productionReady !== false) failures.push("productionReady must remain false");
if (evidence.phkdVerdict !== "BLOCKED") failures.push("phkdVerdict must remain BLOCKED");
if (evidence.finalStatus !== "GOVERNED_PRODUCTION_NO_GO") failures.push("finalStatus must remain GOVERNED_PRODUCTION_NO_GO");
if (evidence.noFakeClaims !== true) failures.push("noFakeClaims must be true");
if (!Array.isArray(evidence.activeBlockers) || evidence.activeBlockers.length < 4) failures.push("activeBlockers must preserve missing gates");
if (evidence.processedImages !== 0) failures.push("processedImages must remain 0 until real image ingestion runs");

evidence.verifiedAt = new Date().toISOString();
evidence.verificationStatus = failures.length === 0 ? "PASS" : "BLOCKED";
evidence.failures = failures;
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

if (failures.length > 0) {
  console.error("VISUAL_HKD_RUNTIME=BLOCKED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("VISUAL_HKD_RUNTIME=SCAFFOLDED");
console.log("PRODUCTION_READY=false");
console.log("FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO");
