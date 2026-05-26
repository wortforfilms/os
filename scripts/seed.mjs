#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const users = JSON.parse(readFileSync("data/seeds/users.json", "utf8"));
mkdirSync("release/evidence", { recursive: true });
writeFileSync(
  "release/evidence/seed-report.json",
  `${JSON.stringify({ schema: "maataa.seed.report.v1", users, state: "STAGED" }, null, 2)}\n`,
  "utf8",
);
console.log(`seeded users manifest: ${users.length}`);
