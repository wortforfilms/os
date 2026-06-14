import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";
import { loadUnicodeData, summarizeUnicodeData, listIndicScripts } from "../packages/lipi-runtime/src/unicode-data.ts";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadUnicodeData(join(root, "data", "unicode", "UnicodeData.txt"));
const summary = summarizeUnicodeData();
const evidence = {
  ...summary,
  indicScripts: listIndicScripts(),
  note: "Generated from data/unicode/UnicodeData.txt at build time. No counts hardcoded. Lipi certification NOT claimed.",
};
writeFileSync(join(root, "release", "evidence", "lipi-unicode-data.json"), JSON.stringify(evidence, null, 2));
console.log("records:", summary.totalRecords, "| indicTotal:", summary.indicTotal, "| unknownBlock:", summary.unknownBlock);
console.log("indic per-block:");
for (const b of evidence.indicScripts) console.log("  " + b.block.padEnd(20), b.count);
