# @maataa/runtime-storage

Sovereign storage runtime with three **real** backends behind one contract:
SQLite, libSQL, and IPFS-spec content addressing.

## What is real (PHKD honest scope)

| Backend | Implementation | Real? | Network |
|---|---|---|---|
| SQLite | `node:sqlite` (`DatabaseSync`) | ✅ file/memory, tested | none |
| libSQL | `@libsql/client` embedded file mode | ✅ file-persistent, tested | none (embedded) |
| IPFS | CIDv1 / raw / sha2-256 via `multiformats` over a local blockstore | ✅ genuine IPFS CIDs | **local only** |

The IPFS layer produces **genuine IPFS CIDs** — verified in tests against the
public canonical vector (`"hello world"` →
`bafkreifzjut3te2nhyekklss27nh3k72ysco7y32koao5eei66wof36n5e`). The same bytes
always yield the same CID that `ipfs add --raw-leaves --cid-version=1` produces.

### What it is NOT

- ❌ Not a node on the **public IPFS network** — no DHT, no bitswap, no peers,
  no pinning service. It is content-addressed *storage*, local-first.
- ❌ Does **not** satisfy `c-databases-7` (7 deployed engines incl.
  Postgres / pgVector / Neo4j / MinIO / Redis + Event Store). That claim
  remains **BLOCKED** — those engines are not deployed by this repo.
- ❌ `governedProductionGo = false`.

## Use

```js
import { StorageRuntime, IpfsBlockStore } from "@maataa/runtime-storage";

const rt = new StorageRuntime({ libsqlUrl: "file:./data/app.db" });
rt.sqlite.put("k", "v");
const cid = await rt.ipfs.put(new TextEncoder().encode("payload"));
console.log(await rt.health());
```

## Verify

```
npm test            # 5 real-backend integration tests
```

The honest-achievements probe `a-resolve-storage-sqlite-libsql-ipfs` runs these
tests and resolves the HKD claim `c-storage-sqlite-libsql-ipfs`
(UNVERIFIED → ACHIEVED) on real evidence. The probe fails closed if the deps are
not installed for the current platform.
