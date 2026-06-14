#!/usr/bin/env node --experimental-strip-types
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";
import { buildGlyphLibrary, glyphCoverage } from "../packages/lipi-runtime/src/glyph-ingestion.ts";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = process.env.MAATAA_UNICODE_DATA || join(root, "data", "unicode", "UnicodeData.txt");
const lib = buildGlyphLibrary(data);
const cov = glyphCoverage(lib);
writeFileSync(join(root, "release", "evidence", "lipi-glyph-library.json"), JSON.stringify(lib, null, 2));
writeFileSync(join(root, "release", "evidence", "lipi-glyph-coverage.json"), JSON.stringify(cov, null, 2));
console.log(`ingested ${lib.total} glyphs across ${lib.scripts.length} Brahmic blocks`);
console.log(`source sha256: ${lib.sourceSha256.slice(0,16)}…`);
console.log(`fabricated-target gap: ${cov.gapToFabricatedTarget} (claimSatisfied=${cov.claimSatisfied})`);
console.log("legacy reconciliation:");
for (const r of cov.legacyReconciliation) console.log(`  ${r.script.padEnd(11)} claimed ${r.claimed}  ingested ${r.ingested}  Δ ${r.delta}`);
