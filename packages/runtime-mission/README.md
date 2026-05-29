# @maataa/runtime-mission

**STATUS: scaffold-only. No runtime behavior yet. Every facade method returns `{ isOk: false, error: { code: "not_implemented" } }`. `health().status === "scaffold"`.**

> ## ⚠ AUTHORITY OVERLAP — PARTIAL
>
> **`@maataa/visual-hkd-runtime` already produces `RealityMatrixEntry[]`
> and `RuntimePackageSuggestion[]`** (via `runtime-generator.ts`).
> This package was scaffolded before that was discovered.
>
> Advisory convergence (not yet executed): rescope this runtime as the
> *consumer/orchestrator* on top of visual-hkd's outputs. Visual-HKD
> **produces** the reality matrix; this runtime **interprets** it into
> mission-vs-reality drift reports and advisory proposed-actions for a
> future `runtime-governance` to enforce. With this rescope it is not
> redundant, but it must not leave scaffold state until the boundary is
> formally documented. See
> `doc/TOPOLOGY_SCAN_2026-05-28_CORRECTION.md` and
> `doc/RUNTIME_FEDERATION_2026-05-28.md` §8.

Reality-to-Mission runtime.
Spec: [`doc/RUNTIME_FEDERATION_2026-05-28.md` §4.4](../../doc/RUNTIME_FEDERATION_2026-05-28.md).

## Responsibility

Compare a declared mission state against observed reality and emit drift signals plus advisory converging actions.

## Non-responsibilities

Does **not** enforce. Does not modify other runtimes. Does not own truth — it reports drift; future `runtime-governance` enforces.

## Authority

Owns: mission specs and drift records.
Read-only against everything else.

## Dependencies

`@maataa/runtime-knowledge-graph`, `@maataa/runtime-validation`, `@maataa/runtime-observability`, `hemant-core`. All read-only.

## Evidence

Each `assess()` emits an immutable `DriftReport` with observed-state digest, declared-state digest, and per-drift items carrying confidence + lineage references into KG / validation / observability.

`propose()` output is emitted as governance *candidates* tagged `enforcement: "none — runtime-governance vacant"` until a governance runtime owns the enforcement path.

## Rollback

Mission specs are deletable. Drift reports stay as evidence and are never overwritten.

## Honest non-claims

- No mission specs declared, no assessments run.
- Cannot enforce anything; `runtime-governance` does not exist yet.
- Drift confidence is contractual intent, not yet a calibrated probability.
