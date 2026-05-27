import { readFileSync, writeFileSync } from "node:fs";

const wallPath = "data/maataa-ecosystem-wall.json";
const evidencePath = "release/evidence/maataa-ecosystem-wall-status.json";
const wall = JSON.parse(readFileSync(wallPath, "utf8"));

const failures = [];

if (wall.topDomains.length !== 5) failures.push(`topDomainCount expected 5, got ${wall.topDomains.length}`);
if (wall.bottomDomains.length !== 4) failures.push(`bottomDomainCount expected 4, got ${wall.bottomDomains.length}`);
if (wall.foundationLayers.length !== 7) failures.push(`foundationLayerCount expected 7, got ${wall.foundationLayers.length}`);
if (wall.technologyFoundation.length !== 12) failures.push(`technologyFoundationCount expected 12, got ${wall.technologyFoundation.length}`);
if (wall.source.verifiedImplementation !== false) failures.push("verifiedImplementation must remain false");
if (wall.governance.productionReady !== false) failures.push("productionReady must remain false");
if (wall.governance.finalStatus !== "GOVERNED_PRODUCTION_NO_GO") failures.push("finalStatus must remain GOVERNED_PRODUCTION_NO_GO");

const statuses = [...wall.topDomains, ...wall.bottomDomains].map((domain) => domain.status);
for (const status of statuses) {
  if (!["READY", "PREVIEW", "BLOCKED", "OFFLINE", "VERIFYING", "DEGRADED"].includes(status)) {
    failures.push(`invalid status: ${status}`);
  }
}

const evidence = {
  schema: "maataa.ecosystem-wall.evidence.v1",
  artifact: wallPath,
  generatedAt: new Date().toISOString(),
  wallModel: "STRUCTURED",
  topDomainCount: wall.topDomains.length,
  bottomDomainCount: wall.bottomDomains.length,
  foundationLayerCount: wall.foundationLayers.length,
  technologyFoundationCount: wall.technologyFoundation.length,
  previewOnly: true,
  productionReady: false,
  phkdVerdict: "BLOCKED",
  finalStatus: "GOVERNED_PRODUCTION_NO_GO",
  activeBlockers: wall.governance.activeBlockers,
  failures
};

writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

if (failures.length > 0) {
  console.error("MAATAA_ECOSYSTEM_WALL=BLOCKED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("MAATAA_ECOSYSTEM_WALL=PASS");
console.log("PREVIEW_ONLY=true");
console.log("FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO");
