/*
 * @maataa/runtime-storage
 * Sovereign storage runtime with three REAL backends:
 *   • SQLite  — node:sqlite (upstream SQLite, zero extra deps)
 *   • libSQL  — @libsql/client in embedded file mode (real Turso/libSQL client)
 *   • IPFS    — IPFS-spec content addressing (CIDv1 / raw / sha2-256) over a
 *              local blockstore, via the canonical `multiformats` library.
 *
 * HONEST SCOPE (PHKD):
 *   - SQLite & libSQL are real, file-backed, and exercised by tests.
 *   - The IPFS layer produces GENUINE IPFS CIDs (verified against the public
 *     "hello world" vector) and is content-addressed, but it is LOCAL-FIRST:
 *     there is NO public-network participation — no DHT, no bitswap, no peers,
 *     no pinning service. It is an IPFS-compatible content store, not a node
 *     joined to the global IPFS network. Do not present it as such.
 *   - This runtime provides 3 of the board's storage backends. It does NOT
 *     satisfy the separate multi-engine claim c-databases-7 (7 deployed engines
 *     incl. Postgres/Neo4j/MinIO/Redis), which remains BLOCKED.
 */
import { DatabaseSync } from "node:sqlite";
import { createClient } from "@libsql/client";
import { IpfsBlockStore, cidOf } from "./ipfs.mjs";

// IPFS content addressing lives in ./ipfs.mjs (multiformats-only) so consumers
// can adopt it without loading the SQL engines. Re-exported here for one-stop use.
export { IpfsBlockStore, cidOf } from "./ipfs.mjs";

/** Common contract every backend implements (deterministic, fail-closed). */
// interface Backend { kind; put(k,v); get(k); del(k); health() }

/** Real SQLite key/value backend (node:sqlite). */
export class SqliteStore {
  constructor(path = ":memory:") {
    this.kind = "sqlite";
    this.path = path;
    this.db = new DatabaseSync(path);
    this.db.exec("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)");
  }
  put(k, v) { this.db.prepare("INSERT OR REPLACE INTO kv(k,v) VALUES(?,?)").run(String(k), String(v)); return true; }
  get(k) { const r = this.db.prepare("SELECT v FROM kv WHERE k=?").get(String(k)); return r ? r.v : null; }
  del(k) { const r = this.db.prepare("DELETE FROM kv WHERE k=?").run(String(k)); return r.changes > 0; }
  health() {
    const ok = this.db.prepare("SELECT 1 AS x").get()?.x === 1;
    return { kind: this.kind, status: ok ? "active" : "degraded", path: this.path, network: false };
  }
}

/** Real libSQL key/value backend (@libsql/client, embedded file mode). */
export class LibsqlStore {
  constructor(url = ":memory:") {
    this.kind = "libsql";
    this.url = url;
    // libSQL embedded: ":memory:" or "file:/abs/path.db"
    this.client = createClient({ url: url === ":memory:" ? ":memory:" : url });
    this._ready = this.client.execute("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)");
  }
  async put(k, v) { await this._ready; await this.client.execute({ sql: "INSERT OR REPLACE INTO kv(k,v) VALUES(?,?)", args: [String(k), String(v)] }); return true; }
  async get(k) { await this._ready; const r = await this.client.execute({ sql: "SELECT v FROM kv WHERE k=?", args: [String(k)] }); return r.rows.length ? r.rows[0].v : null; }
  async del(k) { await this._ready; const r = await this.client.execute({ sql: "DELETE FROM kv WHERE k=?", args: [String(k)] }); return r.rowsAffected > 0; }
  async health() {
    try { await this._ready; const r = await this.client.execute("SELECT 1 AS x"); return { kind: this.kind, status: r.rows[0]?.x === 1 ? "active" : "degraded", url: this.url, network: false }; }
    catch (e) { return { kind: this.kind, status: "degraded", url: this.url, network: false, error: e.message }; }
  }
}

/** Wires the three real backends behind one runtime and exposes health/topology. */
export class StorageRuntime {
  constructor({ sqlitePath = ":memory:", libsqlUrl = ":memory:", blockstore } = {}) {
    this.id = "runtime-storage";
    this.sqlite = new SqliteStore(sqlitePath);
    this.libsql = new LibsqlStore(libsqlUrl);
    this.ipfs = new IpfsBlockStore(blockstore);
  }
  async health() {
    const backends = [this.sqlite.health(), await this.libsql.health(), this.ipfs.health()];
    const allActive = backends.every((b) => b.status === "active");
    return {
      runtime: this.id,
      status: allActive ? "active" : "degraded",
      backends,
      // Honest: this runtime ships 3 backends; it does NOT claim the 7-engine board.
      governedProductionGo: false,
      note: "SQLite+libSQL real & file-capable; IPFS = local content-addressed store (no public network).",
    };
  }
}

export default StorageRuntime;
