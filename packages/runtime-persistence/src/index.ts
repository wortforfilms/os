/*
 * @maataa/runtime-persistence
 * Shared SQLite persistence layer for all runtimes.
 * Spec: real-build task 2 from kanban/Next-in-Line queue
 *
 * Provides: persist(key, value), load(key), delete(key), snapshot(), restore(snapshot)
 */
import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isNodeTestProcess = () => process.argv.some((arg) => /\.test\.[cm]?[jt]s$/.test(arg) || /\/tests?\//.test(arg));
// Use the OS temp dir (portable + writable) for tests, never a hardcoded
// /private/tmp (macOS-only; read-only on Linux sandboxes → broke every runtime).
const defaultDbPath = (runtimeId: string) =>
  isNodeTestProcess()
    ? join(tmpdir(), "maataa-runtime-persistence-tests", String(process.pid), `${runtimeId}.sqlite`)
    : join(__dirname, "..", "..", "..", "data", `${runtimeId}.sqlite`);

export type PersistenceRecord = {
  key: string;
  runtimeId: string;
  value: unknown;
  ts: number;
};

export type PersistenceLoadResult = {
  ok: boolean;
  value: unknown;
  ts: number | null;
};

const dbPool = new Map<string, { db: DatabaseSync; refs: number }>();

export class RuntimePersistence {
  private db: DatabaseSync;
  private runtimeId: string;
  private dbPath: string;

  constructor(runtimeId: string, dbPath?: string) {
    this.runtimeId = runtimeId;
    this.dbPath = dbPath || defaultDbPath(runtimeId);
    if (this.dbPath !== ":memory:") mkdirSync(dirname(this.dbPath), { recursive: true });
    const pooled = dbPool.get(this.dbPath);
    if (pooled) {
      pooled.refs += 1;
      this.db = pooled.db;
    } else {
      this.db = new DatabaseSync(this.dbPath, { timeout: 5000 });
      dbPool.set(this.dbPath, { db: this.db, refs: 1 });
      this.initSchema();
    }
  }

  private initSchema(): void {
    this.db.exec(`PRAGMA busy_timeout = 5000;`);
    // WAL needs shared-memory/mmap, which some mounts (network/exFAT/LaCie) don't
    // support → "disk I/O error". Try WAL, fall back to TRUNCATE so persistence
    // still works on those filesystems instead of crashing the whole runtime.
    if (this.dbPath !== ":memory:") {
      try {
        this.db.exec(`PRAGMA journal_mode = WAL;`);
      } catch {
        try { this.db.exec(`PRAGMA journal_mode = TRUNCATE;`); } catch { /* keep default journal */ }
      }
    }
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS persistence_state (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL,
        runtimeId TEXT NOT NULL,
        value TEXT NOT NULL,
        ts INTEGER NOT NULL,
        UNIQUE(key, runtimeId)
      );
      CREATE INDEX IF NOT EXISTS idx_runtime_key ON persistence_state(runtimeId, key);
    `);
  }

  persist(key: string, value: unknown): { ok: boolean; ts: number } {
    try {
      const ts = Date.now();
      const serialized = JSON.stringify(value);
      const stmt = this.db.prepare(
        `INSERT INTO persistence_state (key, runtimeId, value, ts) VALUES (?, ?, ?, ?)
         ON CONFLICT(key, runtimeId) DO UPDATE SET value = ?, ts = ?`
      );
      stmt.run(key, this.runtimeId, serialized, ts, serialized, ts);
      return { ok: true, ts };
    } catch (err) {
      console.error(`[RuntimePersistence] persist error for key '${key}':`, err);
      return { ok: false, ts: 0 };
    }
  }

  load(key: string): PersistenceLoadResult {
    try {
      const stmt = this.db.prepare(
        `SELECT value, ts FROM persistence_state WHERE key = ? AND runtimeId = ?`
      );
      const row = stmt.get(key, this.runtimeId) as { value: string; ts: number } | undefined;
      if (!row) return { ok: false, value: undefined, ts: null };
      return { ok: true, value: JSON.parse(row.value), ts: row.ts };
    } catch (err) {
      console.error(`[RuntimePersistence] load error for key '${key}':`, err);
      return { ok: false, value: undefined, ts: null };
    }
  }

  delete(key: string): boolean {
    try {
      const stmt = this.db.prepare(
        `DELETE FROM persistence_state WHERE key = ? AND runtimeId = ?`
      );
      stmt.run(key, this.runtimeId);
      return true;
    } catch (err) {
      console.error(`[RuntimePersistence] delete error for key '${key}':`, err);
      return false;
    }
  }

  clear(): boolean {
    try {
      const stmt = this.db.prepare(
        `DELETE FROM persistence_state WHERE runtimeId = ?`
      );
      stmt.run(this.runtimeId);
      return true;
    } catch (err) {
      console.error(`[RuntimePersistence] clear error:`, err);
      return false;
    }
  }

  snapshot(): PersistenceRecord[] {
    try {
      const stmt = this.db.prepare(
        `SELECT key, runtimeId, value, ts FROM persistence_state WHERE runtimeId = ? ORDER BY ts DESC`
      );
      const rows = stmt.all(this.runtimeId) as Array<{ key: string; runtimeId: string; value: string; ts: number }>;
      return rows.map((row) => ({
        key: row.key,
        runtimeId: row.runtimeId,
        value: JSON.parse(row.value),
        ts: row.ts,
      }));
    } catch (err) {
      console.error(`[RuntimePersistence] snapshot error:`, err);
      return [];
    }
  }

  restore(records: PersistenceRecord[]): { restored: number; failed: number } {
    let restored = 0;
    let failed = 0;
    for (const record of records) {
      const result = this.persist(record.key, record.value);
      if (result.ok) restored++;
      else failed++;
    }
    return { restored, failed };
  }

  recordCount(): number {
    try {
      const stmt = this.db.prepare(
        `SELECT COUNT(*) as count FROM persistence_state WHERE runtimeId = ?`
      );
      const row = stmt.get(this.runtimeId) as { count: number };
      return row.count;
    } catch (err) {
      console.error(`[RuntimePersistence] recordCount error:`, err);
      return 0;
    }
  }

  lastWrite(): number | null {
    try {
      const stmt = this.db.prepare(
        `SELECT MAX(ts) as ts FROM persistence_state WHERE runtimeId = ?`
      );
      const row = stmt.get(this.runtimeId) as { ts: number | null };
      return row.ts;
    } catch (err) {
      console.error(`[RuntimePersistence] lastWrite error:`, err);
      return null;
    }
  }

  close(): void {
    try {
      const pooled = dbPool.get(this.dbPath);
      if (!pooled) return;
      pooled.refs -= 1;
      if (pooled.refs <= 0) {
        dbPool.delete(this.dbPath);
        this.db.close();
      }
    } catch (err) {
      console.error(`[RuntimePersistence] close error:`, err);
    }
  }

  health(): { backend: "node:sqlite"; connected: boolean; path: string; recordCount: number; lastWrite: number | null } {
    return {
      backend: "node:sqlite",
      connected: true,
      path: this.dbPath,
      recordCount: this.recordCount(),
      lastWrite: this.lastWrite(),
    };
  }
}

export default RuntimePersistence;
