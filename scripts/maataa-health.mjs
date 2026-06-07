#!/usr/bin/env node
// maataa health — real federation health ops command.
// Run: node --experimental-strip-types scripts/maataa-health.mjs
// Prints each runtime's live health() status; exits non-zero if any is degraded.
import { bootstrap, federationHealth } from "../packages/runtime-federation/src/index.ts";

bootstrap();
const h = federationHealth();
if (!h.isOk) {
  console.error("federation health unavailable:", h.error.detail);
  process.exit(2);
}
console.log("MAATAA federation health");
for (const r of h.data.runtimes) console.log(`  ${r.status === "ready" ? "ok " : "!! "} ${r.runtime}: ${r.status}`);
console.log(`allReady=${h.data.allReady}`);
if (!h.data.allReady) process.exit(1);
