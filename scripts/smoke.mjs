#!/usr/bin/env node
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const required = [
  "src/main.tsx",
  "packages/maataa-ui/src/SovereignDashboard.tsx",
  "data/product-surface-matrix.json",
  "COMPLETION_STATUS_MATRIX.json",
  "release/evidence/latest.json",
];

for (const path of required) {
  if (!existsSync(path)) {
    console.error(`missing smoke artifact: ${path}`);
    process.exit(1);
  }
}

const trackedAssetsHtml = execFileSync("git", ["ls-files", "assets/html"], { encoding: "utf8" }).trim();
if (trackedAssetsHtml) {
  console.error("assets/html is tracked");
  process.exit(1);
}

console.log("smoke passed");
