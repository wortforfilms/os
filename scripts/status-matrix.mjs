#!/usr/bin/env node
import { readFileSync } from "node:fs";

const matrix = JSON.parse(readFileSync("COMPLETION_STATUS_MATRIX.json", "utf8"));
console.log(`FINAL_STATUS=${matrix.finalStatus}`);
console.log(`PRODUCTION_READY=${matrix.productionReady}`);
console.log(`PHKD_VERDICT=${matrix.phkdVerdict}`);
console.log(`BLOCKERS=${matrix.blockers.length}`);
