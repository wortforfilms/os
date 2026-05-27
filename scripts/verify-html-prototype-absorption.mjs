import { existsSync, readFileSync, writeFileSync } from "node:fs";

const inventoryPath = "data/html-prototype-inventory.json";
const evidencePath = "release/evidence/html-prototype-absorption.json";
const failures = [];

if (!existsSync(inventoryPath)) failures.push(`${inventoryPath} is missing`);
if (!existsSync("docs/html-prototype-absorption.md")) failures.push("docs/html-prototype-absorption.md is missing");

const inventory = existsSync(inventoryPath)
  ? JSON.parse(readFileSync(inventoryPath, "utf8"))
  : { prototypes: [], counts: {}, governance: {}, rawPrototypePolicy: {} };

const expectedSources = [
  "boot_ritual.html",
  "dashboard.html",
  "desktop.html",
  "features.html",
  "landing_page.html",
  "maataa_avataar_v2.html",
  "monitor.html",
  "os_holy_screen.html",
  "quick_start.html",
  "sales.html",
  "services.html",
  "systemprocesses.html",
  "usp.html"
];

if (inventory.counts.files !== 13) failures.push(`files expected 13, got ${inventory.counts.files}`);
if (inventory.counts.sourceLines !== 9549) failures.push(`sourceLines expected 9549, got ${inventory.counts.sourceLines}`);
if (inventory.prototypes.length !== 13) failures.push(`prototypes expected 13, got ${inventory.prototypes.length}`);
if (inventory.rawPrototypePolicy.rawHtmlTrackedInRepo !== false) failures.push("raw HTML must not be tracked as release source");
if (inventory.rawPrototypePolicy.assetsHtmlTouched !== false) failures.push("assets/html must remain untouched by absorption");
if (inventory.governance.productionReady !== false) failures.push("productionReady must remain false");
if (inventory.governance.phkdVerdict !== "BLOCKED") failures.push("phkdVerdict must remain BLOCKED");
if (inventory.governance.finalStatus !== "GOVERNED_PRODUCTION_NO_GO") failures.push("finalStatus must remain GOVERNED_PRODUCTION_NO_GO");
if (inventory.governance.noFakeClaims !== true) failures.push("noFakeClaims must be true");

const sources = new Set(inventory.prototypes.map((prototype) => prototype.sourceFile));
for (const source of expectedSources) {
  if (!sources.has(source)) failures.push(`missing prototype source ${source}`);
}

const allowedStatuses = new Set(["READY", "PREVIEW", "BLOCKED", "OFFLINE", "VERIFYING", "DEGRADED"]);
for (const prototype of inventory.prototypes) {
  for (const field of ["frames", "types", "schemas", "dataFrames", "runtimes", "workflows", "ui", "widgets"]) {
    if (!Array.isArray(prototype[field]) || prototype[field].length === 0) {
      failures.push(`${prototype.id}.${field} must contain extracted entries`);
    }
  }
  if (!allowedStatuses.has(prototype.status)) failures.push(`${prototype.id} has invalid status ${prototype.status}`);
  if (prototype.status === "BLOCKED" && !prototype.blockedReason) {
    failures.push(`${prototype.id} is BLOCKED without blockedReason`);
  }
}

const evidence = {
  schema: "maataa.html-prototype-absorption.evidence.v1",
  artifact: inventoryPath,
  generatedAt: new Date().toISOString(),
  sourcePolicy: inventory.sourcePolicy,
  rawHtmlTrackedInRepo: inventory.rawPrototypePolicy.rawHtmlTrackedInRepo,
  assetsHtmlTouched: inventory.rawPrototypePolicy.assetsHtmlTouched,
  prototypeCount: inventory.prototypes.length,
  sourceLineCount: inventory.counts.sourceLines,
  absorbedCategories: ["frames", "types", "schemas", "data_frames", "runtimes", "workflows", "ui", "widgets"],
  productionReady: false,
  phkdVerdict: "BLOCKED",
  finalStatus: "GOVERNED_PRODUCTION_NO_GO",
  activeBlockers: inventory.governance.activeBlockers,
  noFakeClaims: true,
  failures
};

writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

if (failures.length > 0) {
  console.error("HTML_PROTOTYPE_ABSORPTION=BLOCKED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("HTML_PROTOTYPE_ABSORPTION=PASS");
console.log("PRODUCTION_READY=false");
console.log("FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO");
