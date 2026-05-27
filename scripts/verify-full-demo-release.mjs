import { readFileSync, writeFileSync } from "node:fs";

const artifactPath = "release/FULL_DEMO.html";
const evidencePath = "release/evidence/full-demo.json";
const html = readFileSync(artifactPath, "utf8");
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));

const requiredMarkers = [
  "Maataa OS Full Demo",
  "GOVERNED_PRODUCTION_NO_GO",
  "PRODUCTION_READY = FALSE",
  "Aam Jantaa",
  "Runtime Health",
  "Lipi Runtime",
  "Support Center",
  "Maataa Ecosystem Wall",
  "Merkle Data Tree",
  "ThemeLab",
  "Runtime HTML",
  "release/runtime-html/theme_lab.html",
  "release/runtime-html/index.html",
  "hardware_root_attestation_missing",
  "operator_quorum_unverified",
  "signed_release_authority_unverified",
  "rollback_drill_not_verified"
];

const failures = [];
for (const marker of requiredMarkers) {
  if (!html.includes(marker)) failures.push(`missing html marker: ${marker}`);
}

if (evidence.productionReady !== false) failures.push("productionReady must remain false");
if (evidence.finalStatus !== "GOVERNED_PRODUCTION_NO_GO") failures.push("finalStatus must remain GOVERNED_PRODUCTION_NO_GO");
if (!Array.isArray(evidence.includedSurfaces) || evidence.includedSurfaces.length !== 8) failures.push("includedSurfaces must list 8 demo surfaces");

evidence.verifiedAt = new Date().toISOString();
evidence.verificationStatus = failures.length === 0 ? "PASS" : "BLOCKED";
evidence.failures = failures;
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

if (failures.length > 0) {
  console.error("FULL_DEMO=BLOCKED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("FULL_DEMO=RELEASED_STATIC_PREVIEW");
console.log("PRODUCTION_READY=false");
console.log("FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO");
