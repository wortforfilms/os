import { readFileSync, writeFileSync } from "node:fs";

const treePath = "data/maataa-ecosystem-merkle-tree.json";
const evidencePath = "release/evidence/maataa-ecosystem-tree-status.json";
const tree = JSON.parse(readFileSync(treePath, "utf8"));

const failures = [];
const domainCount = tree.domains.length;
const subdomainFrameCount = tree.domains.reduce((sum, domain) => sum + domain.frames.length, 0);
const frameTypeCount = tree.frameTypes.length;
const dataCategoryCount = tree.dataCategories.length;

if (domainCount !== 8) failures.push(`domain count expected 8, got ${domainCount}`);
if (subdomainFrameCount !== 65) failures.push(`sub-domain frame count expected 65, got ${subdomainFrameCount}`);
if (frameTypeCount !== 10) failures.push(`frame type count expected 10, got ${frameTypeCount}`);
if (dataCategoryCount !== 10) failures.push(`data category count expected 10, got ${dataCategoryCount}`);
if (tree.source.rootHashVerified !== false) failures.push("rootHashVerified must remain false until computed from bytes");
if (tree.governance.productionReady !== false) failures.push("productionReady must remain false");
if (tree.governance.finalStatus !== "GOVERNED_PRODUCTION_NO_GO") failures.push("finalStatus must remain GOVERNED_PRODUCTION_NO_GO");

const evidence = {
  schema: "maataa.ecosystem-tree.evidence.v1",
  artifact: treePath,
  generatedAt: new Date().toISOString(),
  treeModel: "STRUCTURED",
  frameCountCheck: failures.length === 0 ? "PASS" : "BLOCKED",
  domainCount,
  subdomainFrameCount,
  frameTypeCount,
  dataCategoryCount,
  rootHashVerification: "BLOCKED_IMAGE_PLACEHOLDER_HASH",
  productionReady: false,
  phkdVerdict: "BLOCKED",
  finalStatus: "GOVERNED_PRODUCTION_NO_GO",
  activeBlockers: tree.governance.activeBlockers,
  failures
};

writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

if (failures.length > 0) {
  console.error("MAATAA_ECOSYSTEM_TREE=BLOCKED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("MAATAA_ECOSYSTEM_TREE=PASS");
console.log("ROOT_HASH_VERIFICATION=BLOCKED_IMAGE_PLACEHOLDER_HASH");
console.log("FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO");
