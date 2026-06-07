#!/usr/bin/env node
// maataa migrate — a real SQLite migration CLI.
//
// Commands: generate <name> | up | down | status | history | help
// Executes SQL via node:sqlite (Node's built-in, run with --experimental-sqlite)
// and tracks applied migrations in a _maataa_migrations table inside the DB
// itself. Migration files live in a migrations dir (default migrations/sqlite),
// named <id>_<name>.sql with optional `-- UP` / `-- DOWN` sections.
//
// PHKD: this genuinely applies/reverts SQL and records a real ledger. It does NOT
// fake success — a failing statement aborts the transaction (fail closed).
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const MIGRATIONS_DIR = process.env.MAATAA_MIGRATIONS_DIR || "migrations/sqlite";
const DB_PATH = process.env.MAATAA_DB || "migrations/maataa.dev.db";

async function openDb() {
  let sqlite;
  try {
    sqlite = await import("node:sqlite");
  } catch (e) {
    console.error("node:sqlite unavailable — run with: node --experimental-sqlite scripts/maataa-migrate.mjs");
    process.exit(2);
  }
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new sqlite.DatabaseSync(DB_PATH);
  db.exec(
    "CREATE TABLE IF NOT EXISTS _maataa_migrations (id TEXT PRIMARY KEY, name TEXT, sha256 TEXT, applied_at TEXT)",
  );
  return db;
}

const migrationFiles = () =>
  existsSync(MIGRATIONS_DIR)
    ? readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql") && !f.startsWith("._")).sort()
    : [];

const idOf = (file) => file.replace(/\.sql$/, "");
const sha = (s) => createHash("sha256").update(s).digest("hex");

function section(sql, marker) {
  // Split on `-- UP` / `-- DOWN`. If no markers, the whole file is the UP body.
  const up = sql.split(/^--\s*DOWN\s*$/im)[0].replace(/^--\s*UP\s*$/im, "");
  const downMatch = sql.split(/^--\s*DOWN\s*$/im)[1];
  return marker === "DOWN" ? (downMatch || "").trim() : up.trim();
}

function applied(db) {
  return db.prepare("SELECT id, name, sha256, applied_at FROM _maataa_migrations ORDER BY id").all();
}

async function cmdGenerate(name) {
  if (!name) {
    console.error("usage: generate <name>");
    process.exit(1);
  }
  mkdirSync(MIGRATIONS_DIR, { recursive: true });
  const id = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const slug = name.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  const file = join(MIGRATIONS_DIR, `${id}_${slug}.sql`);
  writeFileSync(file, `-- UP\n-- write forward SQL here\n\n-- DOWN\n-- write rollback SQL here\n`, "utf8");
  console.log(`created ${file}`);
}

async function cmdUp() {
  const db = await openDb();
  const done = new Set(applied(db).map((r) => r.id));
  const pending = migrationFiles().filter((f) => !done.has(idOf(f)));
  if (pending.length === 0) {
    console.log("up: nothing pending");
    return;
  }
  for (const file of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const body = section(sql, "UP");
    try {
      db.exec("BEGIN");
      if (body) db.exec(body);
      db.prepare("INSERT INTO _maataa_migrations (id,name,sha256,applied_at) VALUES (?,?,?,?)").run(
        idOf(file), file, sha(sql), new Date().toISOString(),
      );
      db.exec("COMMIT");
      console.log(`up: applied ${file}`);
    } catch (e) {
      db.exec("ROLLBACK");
      console.error(`up: FAILED on ${file} — ${e.message} (rolled back, stopping)`);
      process.exit(1);
    }
  }
}

async function cmdDown() {
  const db = await openDb();
  const rows = applied(db);
  if (rows.length === 0) {
    console.log("down: nothing applied");
    return;
  }
  const last = rows[rows.length - 1];
  const file = `${last.id}.sql`.replace(/^(\d+)\.sql$/, last.name || `${last.id}.sql`);
  const path = join(MIGRATIONS_DIR, last.name || `${last.id}.sql`);
  const downSql = existsSync(path) ? section(readFileSync(path, "utf8"), "DOWN") : "";
  try {
    db.exec("BEGIN");
    if (downSql) db.exec(downSql);
    db.prepare("DELETE FROM _maataa_migrations WHERE id = ?").run(last.id);
    db.exec("COMMIT");
    console.log(`down: reverted ${last.name || last.id}${downSql ? "" : " (no DOWN section; ledger entry removed)"}`);
  } catch (e) {
    db.exec("ROLLBACK");
    console.error(`down: FAILED — ${e.message} (rolled back)`);
    process.exit(1);
  }
}

async function cmdStatus() {
  const db = await openDb();
  const done = new Set(applied(db).map((r) => r.id));
  const files = migrationFiles();
  for (const f of files) console.log(`${done.has(idOf(f)) ? "[applied]" : "[pending]"} ${f}`);
  console.log(`status: ${files.length} migrations, ${done.size} applied, ${files.length - done.size} pending`);
}

async function cmdHistory() {
  const db = await openDb();
  const rows = applied(db);
  for (const r of rows) console.log(`${r.applied_at}  ${r.id}  ${r.name}  ${r.sha256.slice(0, 12)}…`);
  console.log(`history: ${rows.length} applied migration(s)`);
}

const [cmd, ...rest] = process.argv.slice(2);
const commands = { generate: () => cmdGenerate(rest[0]), up: cmdUp, down: cmdDown, status: cmdStatus, history: cmdHistory };
if (cmd === "help" || !cmd) {
  console.log("maataa migrate — generate <name> | up | down | status | history");
} else if (commands[cmd]) {
  await commands[cmd]();
} else {
  console.error(`unknown command: ${cmd}`);
  process.exit(1);
}
