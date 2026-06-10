// Real integration tests for @maataa/runtime-storage.
// Exercises actual reads/writes through SQLite, libSQL, and the IPFS-spec
// content store. Fail-closed: no mocks, no hardcoded passes.
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStore, LibsqlStore, IpfsBlockStore, StorageRuntime } from "../src/index.mjs";

const tmp = mkdtempSync(join(tmpdir(), "maataa-storage-"));

test("SQLite backend: real put/get/del (node:sqlite)", () => {
  const s = new SqliteStore(":memory:");
  assert.equal(s.get("a"), null);
  s.put("a", "alpha");
  assert.equal(s.get("a"), "alpha");
  assert.equal(s.del("a"), true);
  assert.equal(s.get("a"), null);
  assert.equal(s.health().status, "active");
});

test("libSQL backend: real file-mode persistence (@libsql/client)", async () => {
  const url = `file:${join(tmp, "libsql.db")}`;
  const a = new LibsqlStore(url);
  await a.put("k", "real-libsql-value");
  assert.equal(await a.get("k"), "real-libsql-value");
  // reopen the same file → value persisted to disk, proving a real engine
  const b = new LibsqlStore(url);
  assert.equal(await b.get("k"), "real-libsql-value");
  assert.equal((await b.health()).status, "active");
});

test("IPFS store: CID matches the canonical public 'hello world' vector", async () => {
  const cid = await IpfsBlockStore.cidOf(new TextEncoder().encode("hello world"));
  assert.equal(cid, "bafkreifzjut3te2nhyekklss27nh3k72ysco7y32koao5eei66wof36n5e");
});

test("IPFS store: content-addressed put/get is deterministic & round-trips", async () => {
  const ipfs = new IpfsBlockStore();
  const bytes = new TextEncoder().encode("sovereign data");
  const cid1 = await ipfs.put(bytes);
  const cid2 = await IpfsBlockStore.cidOf(bytes); // same bytes → same CID
  assert.equal(cid1, cid2);
  assert.ok(cid1.startsWith("bafkrei")); // CIDv1, raw, base32
  const got = await ipfs.get(cid1);
  assert.deepEqual(got, bytes);
  assert.equal(await ipfs.has(cid1), true);
  assert.equal(ipfs.health().network, false); // honest: local only
});

test("StorageRuntime: all three backends report active; not over-claimed", async () => {
  const rt = new StorageRuntime({
    sqlitePath: ":memory:",
    libsqlUrl: `file:${join(tmp, "rt-libsql.db")}`,
  });
  const h = await rt.health();
  assert.equal(h.status, "active");
  assert.deepEqual(h.backends.map((b) => b.kind).sort(), ["ipfs", "libsql", "sqlite"]);
  assert.ok(h.backends.every((b) => b.network === false));
  assert.equal(h.governedProductionGo, false); // never claims production
});
