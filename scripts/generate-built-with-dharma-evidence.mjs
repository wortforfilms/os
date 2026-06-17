#!/usr/bin/env node
/*
 * Writes release/evidence/built-with-dharma.json from real facet checks.
 * Run: node scripts/generate-built-with-dharma-evidence.mjs
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateDharma } from "./lib/dharma-facets.mjs";

const root = process.cwd();
const { facets, overallPass } = evaluateDharma({ root, join, existsSync, readFileSync, readdirSync });

const evidence = {
  schema: "maataa.built-with-dharma.v1",
  generatedAt: new Date().toISOString(),
  claim: "c-built-with-dharma",
  reviewState: overallPass ? "VERIFIED" : "CONTROLLED_NO_GO",
  governedProductionGo: false,
  honesty:
    "Six design properties checked against real artifacts. 'Open Source' is granted by a custom sovereign license " +
    "(Tantrāṃśa Ājñāpatra) that confers the four software freedoms; this is not an OSI-certification claim. " +
    "A facet passes only with a backing artifact; the claim is ACHIEVED only if all six pass.",
  overallPass,
  facets,
};

writeFileSync(join(root, "release/evidence/built-with-dharma.json"), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`built-with-dharma: ${facets.filter((f) => f.pass).length}/${facets.length} facets pass | overall ${overallPass ? "ACHIEVED" : "BLOCKED"}`);
for (const f of facets) console.log(`  [${f.pass ? "PASS" : "FAIL"}] ${f.name}: ${f.proof}`);
