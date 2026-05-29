# @maataa/runtime-knowledge-graph

**STATUS: scaffold-only. No runtime behavior yet. Every facade method returns `{ isOk: false, error: { code: "not_implemented" } }`. `health().status === "scaffold"`.**

> ## ⚠ AUTHORITY OVERLAP — DIRECT
>
> **`@maataa/kbs-graph` already owns this scope** (typed graph relations,
> traversal, metrics, validation — facade over `kbs-runtime/src/graph/`).
> This package was scaffolded before `kbs-graph` was discovered. It is
> **currently redundant.**
>
> Advisory convergence (not yet executed): collapse into `kbs-graph`, or
> rescope as a *multi-graph aggregator* that fuses `kbs-graph` +
> `visual-hkd-runtime`'s `KnowledgeGraphProjection` + `lipi-runtime`'s
> script lineage. This package must not leave scaffold state until
> reconciled. See `doc/TOPOLOGY_SCAN_2026-05-28_CORRECTION.md` and
> `doc/RUNTIME_FEDERATION_2026-05-28.md` §8.

Spec: [`doc/RUNTIME_FEDERATION_2026-05-28.md` §4.2](../../doc/RUNTIME_FEDERATION_2026-05-28.md).

## Responsibility

Typed entity + relation store. Owns "what is connected to what" in the MAATAA semantic graph.

## Non-responsibilities

Does **not** own:

- claim validity → `runtime-validation`
- identity / namespace / signature → `runtime-hkd-registry`
- enforcement → vacant (future `runtime-governance`)
- static page-local KV → `assets/_sdk/data_sdk.js`

## Authority

Owns: the relation set and entity-type schema. Entity ids are minted by `runtime-hkd-registry` when canonical, or local-only if uncanonical (clearly marked).

## Dependencies

`@maataa/runtime-hkd-registry`, `hemant-core`. Read-only towards both.

## Evidence

Every edge optionally carries an `evidenceRef` pointing to a `runtime-hkd-registry` artifact id or a `runtime-validation` record id. Edges without provenance default to `moderationState: 'proposed'`.

## Rollback

Append-only snapshots with revision pins. Rollback = restore to a Registry-pinned snapshot id. No destructive deletes.

## Honest non-claims

- No entity types, entities, or edges are stored.
- The "append-only with revision pins" semantics are contractual intent, not implementation.
- `runtime-hkd-registry` and `runtime-validation` are themselves scaffolds, so the evidence chain ends at scaffolds today.
