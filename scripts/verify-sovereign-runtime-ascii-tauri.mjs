import { readFileSync, writeFileSync } from "node:fs";

const dataPath = "data/sovereign-runtime-ascii-tauri.json";
const htmlPath = "release/SOVEREIGN_RUNTIME_ASCII_TAURI.html";
const evidencePath = "release/evidence/sovereign-runtime-ascii-tauri.json";
const rustPath = "src-tauri/src/main.rs";

const data = JSON.parse(readFileSync(dataPath, "utf8"));
const html = readFileSync(htmlPath, "utf8");
const rust = readFileSync(rustPath, "utf8");
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));

const requiredMarkers = [
  "MAATAA OS :: SOVEREIGN RUNTIME ASCII :: TAURI SHELL",
  "CONTROLLED_CONVERGENCE",
  "GOVERNED_PRODUCTION_NO_GO",
  "PRODUCTION READY     FALSE",
  "hardware_attestation_missing",
  "operator_quorum_unverified",
  "signed_release_authority_unverified",
  "rollback_drill_not_verified"
];

const failures = [];
for (const marker of requiredMarkers) {
  if (!html.includes(marker) && !JSON.stringify(data).includes(marker)) failures.push(`missing marker: ${marker}`);
}

for (const command of ["sovereign_ascii_status", "sovereign_ascii_frame"]) {
  if (!rust.includes(command)) failures.push(`missing Tauri command: ${command}`);
}

if (data.productionReady !== false || evidence.productionReady !== false) failures.push("productionReady must remain false");
if (data.finalStatus !== "GOVERNED_PRODUCTION_NO_GO") failures.push("data finalStatus must remain GOVERNED_PRODUCTION_NO_GO");
if (evidence.finalStatus !== "GOVERNED_PRODUCTION_NO_GO") failures.push("evidence finalStatus must remain GOVERNED_PRODUCTION_NO_GO");
if (data.frame.encoding !== "ASCII") failures.push("frame encoding must be ASCII");
if (data.frame.columns !== 80) failures.push("frame must preserve 80-column ASCII contract");
if (!Array.isArray(data.frame.lines) || data.frame.lines.length < 20) failures.push("ASCII frame must include at least 20 lines");

evidence.verifiedAt = new Date().toISOString();
evidence.verificationStatus = failures.length === 0 ? "PASS" : "BLOCKED";
evidence.failures = failures;
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

if (failures.length > 0) {
  console.error("SOVEREIGN_RUNTIME_ASCII_TAURI=BLOCKED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("SOVEREIGN_RUNTIME_ASCII_TAURI=RELEASED_STATIC_PREVIEW");
console.log("PRODUCTION_READY=false");
console.log("FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO");
