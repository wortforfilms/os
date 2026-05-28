import { readFileSync, writeFileSync } from "node:fs";

const artifactPath = "release/KBS_FULL_DEMO.html";
const evidencePath = "release/evidence/kbs-full-demo.json";
const html = readFileSync(artifactPath, "utf8");
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));

const requiredMarkers = [
  "KBS Full Demo",
  "Knowledge Base System",
  "GOVERNED_PRODUCTION_NO_GO",
  "PRODUCTION_READY = FALSE",
  "Full Demo - All Pages Overview",
  "All Runtimes Board",
  "55 total runtimes",
  "Knowledge Graph Overview",
  "Claim Status Distribution",
  "Evidence Strength",
  "Review Queue",
  "Domain Overview",
  "System Health",
  "Quick Actions",
  "426",
  "312,880",
  "hardware_attestation_missing",
  "operator_quorum_unverified",
  "rollback_drill_verification_missing"
];

const failures = [];
const evidenceText = JSON.stringify(evidence);
for (const marker of requiredMarkers) {
  if (!html.includes(marker) && !evidenceText.includes(marker)) failures.push(`missing marker: ${marker}`);
}

if (evidence.productionReady !== false) failures.push("productionReady must remain false");
if (evidence.phkdVerdict !== "BLOCKED") failures.push("phkdVerdict must remain BLOCKED");
if (evidence.finalStatus !== "GOVERNED_PRODUCTION_NO_GO") failures.push("finalStatus must remain GOVERNED_PRODUCTION_NO_GO");
if (!Array.isArray(evidence.includedSurfaces) || evidence.includedSurfaces.length !== 10) failures.push("includedSurfaces must list 10 KBS demo surfaces");
if (!Array.isArray(evidence.activeBlockers) || evidence.activeBlockers.length < 7) failures.push("activeBlockers must preserve KBS maturity blockers");

evidence.verifiedAt = new Date().toISOString();
evidence.verificationStatus = failures.length === 0 ? "PASS" : "BLOCKED";
evidence.failures = failures;
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

if (failures.length > 0) {
  console.error("KBS_FULL_DEMO=BLOCKED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("KBS_FULL_DEMO=RELEASED_STATIC_PREVIEW");
console.log("PRODUCTION_READY=false");
console.log("FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO");
