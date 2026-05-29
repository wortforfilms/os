# @maataa/runtime-observability

**STATUS: scaffold-only. No runtime behavior yet. Every facade method returns `{ isOk: false, error: { code: "not_implemented" } }`. `health().status === "scaffold"`.**

> ## ⚠ AUTHORITY OVERLAP — THREE PRE-EXISTING OWNERS
>
> Observability is **already owned three different ways** in this repo:
> - **`@maataa/maataa-ui/observatory/*`** — Runtime Observatory UI
>   (`RuntimeObservatory`, `EphemerisObservatory`, `UniversalObservatory`,
>   `ObservatoryShell`).
> - **`@maataa/evidence-runtime`** — evidence loader feeding the
>   observatory (`loadRuntimeObservatoryEvidence`).
> - **`kbs-runtime/src/observability/`** — KBS-internal observability.
>
> The PHKD AUTHORITY RULE says telemetry must not be silently
> co-owned. This is a pre-existing condition not introduced by this
> scaffold, but this scaffold must not deepen it.
>
> Advisory convergence (not yet executed): rescope this runtime as a
> **pure non-UI cross-runtime aggregator library** that `maataa-ui`
> consumes and `evidence-runtime` feeds — explicitly **not** shadowing
> either. Must not leave scaffold state until the scope split is
> documented in writing. See
> `doc/TOPOLOGY_SCAN_2026-05-28_CORRECTION.md` and
> `doc/RUNTIME_FEDERATION_2026-05-28.md` §8.

Adopts the directive's `runtime-observability` slot.
Spec: [`doc/RUNTIME_FEDERATION_2026-05-28.md` §4.1](../../doc/RUNTIME_FEDERATION_2026-05-28.md).

## Responsibility

Read-only aggregation of `health()`, topology, and lineage signals exposed by every other federation runtime. Presents the observability fabric.

## Non-responsibilities

Does **not** own moderation, release, governance, time, identity, claim validity, mission state, or any underlying runtime state. Never writes into observed runtimes.

## Authority

Owns: the aggregated observability view.
Does not own: any source-of-truth held by an observed runtime.

## Dependencies

Reads `.health()` from every other runtime. No upward dependencies. **Acyclic.**

## Evidence

Each collection emits an immutable record with source health digests and time sourced from `hemant-core`. At scaffold stage no collections are performed; `health().evidence.notes` reports `scope: 'unresolved'`.

## Rollback

Pure data. Deleting this package removes the view; observed runtimes are unaffected.

## Honest non-claims

- No collection runs.
- No topology graph is computed.
- No lineage records exist.
- `runtime-hkd-registry` does not yet exist, so collection scope is `[]`.
