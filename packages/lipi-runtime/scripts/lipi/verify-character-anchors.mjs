import { readFileSync } from "node:fs";

const source = readFileSync("packages/lipi-runtime/src/characters/token-anchors.ts", "utf8");
const anchorCount = (source.match(/anchorStatus:/g) ?? []).length;

if (anchorCount < 4) {
  console.error("LIPI_CHARACTER_ANCHORS=BLOCKED");
  process.exit(1);
}

console.log(`LIPI_CHARACTER_ANCHORS=PASS count=${anchorCount}`);
