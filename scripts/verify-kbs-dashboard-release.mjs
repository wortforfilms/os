import { readFileSync, writeFileSync } from "node:fs";

const artifactPath = "release/KBS_DASHBOARD.html";
const evidencePath = "release/evidence/kbs-dashboard.json";
const html = readFileSync(artifactPath, "utf8");
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));

const requiredMarkers = [
  "KBS Dashboard",
  "Knowledge Base System",
  "GOVERNED_PRODUCTION_NO_GO",
  "PRODUCTION_READY = FALSE",
  "Knowledge Graph Overview",
  "Claim Status Distribution",
  "Evidence Strength",
  "Review Queue",
  "Domain Overview",
  "System Health",
  "Quick Actions",
  "54,230",
  "312,880",
  "426",
  "hardware_attestation_not_verified"
];

const failures = [];
for (const marker of requiredMarkers) {
  if (!html.includes(marker) && !JSON.stringify(evidence).includes(marker)) failures.push(`missing marker: ${marker}`);
}

if (evidence.productionReady !== false) failures.push("productionReady must remain false");
if (evidence.phkdVerdict !== "BLOCKED") failures.push("phkdVerdict must remain BLOCKED");
if (evidence.finalStatus !== "GOVERNED_PRODUCTION_NO_GO") failures.push("finalStatus must remain GOVERNED_PRODUCTION_NO_GO");
if (!Array.isArray(evidence.activeBlockers) || evidence.activeBlockers.length !== 4) failures.push("activeBlockers must list four dashboard blockers");

evidence.verifiedAt = new Date().toISOString();
evidence.verificationStatus = failures.length === 0 ? "PASS" : "BLOCKED";
evidence.failures = failures;
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

if (failures.length > 0) {
  console.error("KBS_DASHBOARD=BLOCKED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("KBS_DASHBOARD=RELEASED_STATIC_PREVIEW");
console.log("PRODUCTION_READY=false");
console.log("FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO");
