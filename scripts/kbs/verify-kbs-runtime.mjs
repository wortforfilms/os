#!/usr/bin/env node
import { readFileSync } from "node:fs";

const evidence = JSON.parse(readFileSync("release/evidence/kbs-runtime-hardening.json", "utf8"));
const extraction = JSON.parse(readFileSync("data/kbs-image-extraction.json", "utf8"));

const failures = [];

if (evidence.productionReady !== false) failures.push("productionReady must remain false");
if (evidence.finalStatus !== "GOVERNED_PRODUCTION_NO_GO") failures.push("finalStatus must remain GOVERNED_PRODUCTION_NO_GO");
if (evidence.phkdVerdict !== "BLOCKED") failures.push("phkdVerdict must remain BLOCKED");
if (evidence.noFakeClaims !== true) failures.push("noFakeClaims must be true");
if (!Array.isArray(evidence.activeBlockers) || evidence.activeBlockers.length < 7) failures.push("activeBlockers are incomplete");
if (!Array.isArray(extraction.pages) || extraction.pages.length !== 17) failures.push("17 extracted KBS pages are required");

if (failures.length > 0) {
  console.error("KBS runtime verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("KBS runtime verification: PASS");
console.log("Final status: GOVERNED_PRODUCTION_NO_GO");
