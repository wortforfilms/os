import { readFileSync, writeFileSync } from "node:fs";

const artifactPath = "release/MATA_OS_SUPPORT_CENTER.html";
const evidencePath = "release/evidence/mata-os-support-center.json";
const html = readFileSync(artifactPath, "utf8");
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));

const failures = [];

for (const required of [
  "MATA OS Support Center",
  "GOVERNED_PRODUCTION_NO_GO",
  "PRODUCTION_READY = FALSE",
  "docs/user-guide.md",
  "docs/support.md",
  "docs/troubleshooting.md",
  "docs/faq.md",
  "docs/support/support-request-template.md",
  "docs/support/operator-escalation.md",
  "docs/support/release-support-checklist.md"
]) {
  if (!html.includes(required)) failures.push(`missing html marker: ${required}`);
}

if (evidence.productionReady !== false) failures.push("productionReady must remain false");
if (evidence.finalStatus !== "GOVERNED_PRODUCTION_NO_GO") failures.push("finalStatus must remain GOVERNED_PRODUCTION_NO_GO");
if (evidence.documentsEmbedded !== 7) failures.push("documentsEmbedded must equal 7");

evidence.verifiedAt = new Date().toISOString();
evidence.verificationStatus = failures.length === 0 ? "PASS" : "BLOCKED";
evidence.failures = failures;
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

if (failures.length > 0) {
  console.error("MATA_OS_SUPPORT_CENTER=BLOCKED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("MATA_OS_SUPPORT_CENTER=RELEASED_STATIC_PREVIEW");
console.log("PRODUCTION_READY=false");
console.log("FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO");
