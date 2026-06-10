# @maataa/runtime-data

The platform relational **ERD** for the data-schemas universe — the 13-table data
model named on the board (claim `c-erd-13-tables`).

## Honest scope (PHKD)

This package is a **schema / design artifact**, not a running database.

- ✅ Real, valid Prisma schema with 13 entities and foreign-key relations.
- ❌ No applied migrations, no deployed engine, no production data.
- ❌ Does **not** imply the multi-engine claim (`c-databases-7`:
  SQLite/libSQL/Postgres/pgVector/Neo4j/MinIO/Redis + Event Store) — that remains
  BLOCKED. The only real engine in the repo is SQLite (`node:sqlite`, via
  `@maataa/runtime-persistence`).
- ❌ Does **not** imply the distributed storage claim
  (`c-storage-sqlite-libsql-ipfs`) — libSQL and IPFS are not wired.

## The 13 entities

`User`, `Profile`, `Role`, `Permission`, `Project`, `Task`, `Milestone`,
`KnowledgeNode`, `KnowledgeRelation`, `KnowledgeSource`, `Document`, `Asset`,
`Event`.

Relations: User 1–1 Profile; User n–m Role; Role n–m Permission; Project 1–n
Task / Milestone / Document / Asset; Task n–1 Milestone (optional) and Assignee;
KnowledgeNode self-relation via KnowledgeRelation; KnowledgeNode n–1
KnowledgeSource; Document → Project / Author / KnowledgeNode; Event → actor User.

## Verify

```
npx prisma validate --schema prisma/schema.prisma
```

The honest-achievements probe `a-resolve-data-erd-13-tables` parses this schema
and confirms all 13 named models plus their relations exist. It resolves the HKD
claim `c-erd-13-tables` from PARTIAL → ACHIEVED on real evidence. Advancing the
claim to a *deployed* database would require migrations + a real engine and is
explicitly out of scope here.
