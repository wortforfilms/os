import { readFileSync } from "node:fs";

const readiness = JSON.parse(readFileSync("packages/lipi-runtime/release/evidence/lipi-amirpur-readiness.json", "utf8"));

if (readiness.finalStatus !== "GOVERNED_PRODUCTION_NO_GO") {
  console.error("AMIRPUR_SMOKE=BLOCKED invalid final status");
  process.exit(1);
}

console.log("AMIRPUR_SMOKE=PASS preview-only field profile loaded");
