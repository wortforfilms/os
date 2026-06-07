import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "maataa-migrate-"));
const migs = join(tmp, "migs");
const db = join(tmp, "test.db");
const env = { ...process.env, MAATAA_MIGRATIONS_DIR: migs, MAATAA_DB: db };
const cli = (cmd) =>
  execFileSync("node", ["--experimental-sqlite", "scripts/maataa-migrate.mjs", ...cmd.split(" ")], {
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

test("maataa migrate: full generate/up/down/status/history lifecycle with real SQL", () => {
  // generate creates a real file
  const gen = cli("generate create_things");
  assert.match(gen, /created /);
  // remove the empty generated stub so the lifecycle below counts only our two
  const genPath = gen.replace(/^created\s+/, "").trim();
  rmSync(genPath, { force: true });

  // two migrations: m2 inserts into a table m1 creates — proves UP actually executes
  writeFileSync(join(migs, "001_create.sql"), "-- UP\nCREATE TABLE things (id INTEGER PRIMARY KEY, name TEXT);\n-- DOWN\nDROP TABLE things;\n");
  writeFileSync(join(migs, "002_seed.sql"), "-- UP\nINSERT INTO things (name) VALUES ('alpha');\n-- DOWN\nDELETE FROM things WHERE name='alpha';\n");

  // status before up: pending
  assert.match(cli("status"), /\[pending\] 001_create\.sql/);

  // up applies both (002 would fail if 001's CREATE didn't really run)
  const up = cli("up");
  assert.match(up, /applied 001_create\.sql/);
  assert.match(up, /applied 002_seed\.sql/);

  // status after up: applied
  const status = cli("status");
  assert.match(status, /\[applied\] 001_create\.sql/);
  assert.match(status, /\[applied\] 002_seed\.sql/);

  // history shows 2
  assert.match(cli("history"), /history: 2 applied migration/);

  // down reverts the last
  assert.match(cli("down"), /reverted/);
  assert.match(cli("history"), /history: 1 applied migration/);
});

test.after(() => rmSync(tmp, { recursive: true, force: true }));
