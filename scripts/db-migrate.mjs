#!/usr/bin/env node
import { readdirSync, writeFileSync, mkdirSync } from "node:fs";

const migrations = readdirSync("migrations/sqlite").filter((file) => file.endsWith(".sql")).sort();
mkdirSync("release/evidence", { recursive: true });
writeFileSync(
  "release/evidence/db-migration-report.json",
  `${JSON.stringify({ schema: "maataa.db.migration.report.v1", state: "STAGED", migrations }, null, 2)}\n`,
  "utf8",
);
console.log(`sqlite migrations discovered: ${migrations.length}`);
