import { existsSync, readFileSync, writeFileSync } from "node:fs";

const inventory = JSON.parse(readFileSync("data/html-prototype-inventory.json", "utf8"));
const themeLab = JSON.parse(readFileSync("data/theme-lab-runtime.json", "utf8"));
const manifestPath = "release/runtime-html/manifest.json";
const evidencePath = "release/evidence/runtime-html-verification.json";
const failures = [];

if (!existsSync(manifestPath)) failures.push(`${manifestPath} is missing`);
if (!existsSync("release/runtime-html/index.html")) failures.push("runtime HTML index is missing");
if (!existsSync("release/runtime-html/theme_lab.html")) failures.push("ThemeLab runtime HTML page is missing");

const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, "utf8"))
  : { pages: [], productionReady: true, rawHtmlCopied: true };

if (manifest.productionReady !== false) failures.push("runtime HTML productionReady must remain false");
if (manifest.finalStatus !== "GOVERNED_PRODUCTION_NO_GO") failures.push("runtime HTML finalStatus must remain GOVERNED_PRODUCTION_NO_GO");
if (manifest.rawHtmlCopied !== false) failures.push("runtime HTML must not copy raw prototype files");
if (manifest.noFakeClaims !== true) failures.push("runtime HTML noFakeClaims must be true");
if (!existsSync("release/runtime-html/services_and_features.html")) failures.push("services and features page is missing");

if (manifest.pages.length !== inventory.prototypes.length + 3) {
  failures.push(`runtime HTML pages expected ${inventory.prototypes.length + 3}, got ${manifest.pages.length}`);
}

for (const prototype of inventory.prototypes) {
  const pagePath = `release/runtime-html/${prototype.id}.html`;
  if (!existsSync(pagePath)) {
    failures.push(`${pagePath} is missing`);
    continue;
  }
  const html = readFileSync(pagePath, "utf8");
  for (const required of ["Frames", "Types", "Schemas", "Data Frames", "Runtimes", "Workflows", "UI", "Widgets"]) {
    if (!html.includes(required)) failures.push(`${pagePath} missing ${required}`);
  }
  if (!html.includes("GOVERNED_PRODUCTION_NO_GO")) failures.push(`${pagePath} missing governed no-go state`);
}

const indexHtml = existsSync("release/runtime-html/index.html")
  ? readFileSync("release/runtime-html/index.html", "utf8")
  : "";
if (indexHtml.includes("/Volumes/LaCie/pprm/revenue/live/maataa/code/html")) {
  failures.push("runtime HTML index must not expose external source root");
}

const focusHtml = existsSync("release/runtime-html/services_and_features.html")
  ? readFileSync("release/runtime-html/services_and_features.html", "utf8")
  : "";
if (!focusHtml.includes("Maataa OS Services") || !focusHtml.includes("Maataa OS Features")) {
  failures.push("services and features focus page must include both surfaces");
}

const themeLabHtml = existsSync("release/runtime-html/theme_lab.html")
  ? readFileSync("release/runtime-html/theme_lab.html", "utf8")
  : "";
for (const required of ["ThemeLab", "Quick Stack Builder", "CSS Variables", "Missing Runtime Layers", "FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO"]) {
  if (!themeLabHtml.includes(required)) failures.push(`theme_lab.html missing ${required}`);
}
if (themeLab.governance.productionReady !== false) failures.push("ThemeLab productionReady must remain false");
if (themeLab.themeFamilies[0].count !== 67) failures.push("ThemeLab must preserve 67 theme count");

const evidence = {
  schema: "maataa.runtime-html.verification.v1",
  generatedAt: new Date().toISOString(),
  manifest: manifestPath,
  pageCount: manifest.pages.length,
  expectedPageCount: inventory.prototypes.length + 3,
  productionReady: false,
  phkdVerdict: "BLOCKED",
  finalStatus: "GOVERNED_PRODUCTION_NO_GO",
  failures
};

writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

if (failures.length > 0) {
  console.error("RUNTIME_HTML=BLOCKED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("RUNTIME_HTML=PASS");
console.log("PRODUCTION_READY=false");
console.log("FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO");
