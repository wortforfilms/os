import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const packageRoot = join(root, "packages/lipi-runtime");
const registryPath = join(packageRoot, "src/data/lipi-426-master.ts");
const evidencePath = join(packageRoot, "release/evidence/lipi-registry-status.json");
const reportPath = join(packageRoot, "release/evidence/lipi-release-verification.json");

const failures = [];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

if (!existsSync(packageRoot)) failures.push("packages/lipi-runtime is missing");

const packageJson = readJson(join(packageRoot, "package.json"));
if (packageJson.name !== "@maataa/lipi-runtime") failures.push("package name must be @maataa/lipi-runtime");
if (!existsSync(registryPath)) failures.push("lipi-426-master.ts is missing");
if (!existsSync(evidencePath)) failures.push("lipi registry evidence is missing");

const registrySource = existsSync(registryPath) ? readFileSync(registryPath, "utf8") : "";
for (const requiredId of ["brahmi", "kharosthi", "siddham", "sharada", "landa", "kaithi", "mahajani"]) {
  if (!registrySource.includes(`id: "${requiredId}"`)) failures.push(`required script missing: ${requiredId}`);
}
if (!registrySource.includes("426 - canonicalScripts.length")) failures.push("registry must deterministically allocate 426 slots");

const evidence = existsSync(evidencePath) ? readJson(evidencePath) : {};
if (evidence.productionReady !== false) failures.push("productionReady must remain false");
if (evidence.phkdVerdict !== "BLOCKED") failures.push("phkdVerdict must remain BLOCKED");
if (evidence.finalStatus !== "GOVERNED_PRODUCTION_NO_GO") failures.push("finalStatus must remain GOVERNED_PRODUCTION_NO_GO");
if (evidence.scriptRegistry?.expected !== 426) failures.push("expected registry count must be 426");
if (evidence.scriptRegistry?.ingested !== 426) failures.push("ingested registry count must be 426");
if (!Array.isArray(evidence.activeBlockers) || evidence.activeBlockers.length < 4) failures.push("active blockers must be present");

const report = {
  schema: "maataa.lipi-runtime.release-verification.v1",
  package: "@maataa/lipi-runtime",
  generatedAt: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "BLOCKED",
  productionReady: false,
  phkdVerdict: "BLOCKED",
  finalStatus: "GOVERNED_PRODUCTION_NO_GO",
  failures,
};

writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

if (failures.length > 0) {
  console.error("LIPI_RELEASE_VERIFY=BLOCKED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("LIPI_RELEASE_VERIFY=PASS");
console.log("PRODUCTION_READY=false");
console.log("FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO");
