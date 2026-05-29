# @maataa/runtime-validation

**STATUS: scaffold-only. No runtime behavior yet. Every facade method returns `{ isOk: false, error: { code: "not_implemented" } }`. `health().status === "scaffold"`.**

> ## ⚠ AUTHORITY OVERLAP — DIRECT
>
> **`kbs-runtime/src/claims/` + `@maataa/kbs-governance` already own claim
> validation** (`classifyClaim`, `freezeUnsupportedClaim`,
> `detectContradictions`, `evaluateKbsGate`, `rejectProductionClaim`).
> This package was scaffolded before they were discovered. It is
> **currently redundant.**
>
> Advisory convergence (not yet executed): collapse into the existing
> claim pipeline, or rescope as *scientific-method validation* (methodology
> spec, replication tracking, uncertainty bookkeeping) that sits **above**
> claim classification rather than replacing it. This package must not
> leave scaffold state until reconciled. See
> `doc/TOPOLOGY_SCAN_2026-05-28_CORRECTION.md` and
> `doc/RUNTIME_FEDERATION_2026-05-28.md` §8.

Scientific Validation runtime.
Spec: [`doc/RUNTIME_FEDERATION_2026-05-28.md` §4.5](../../doc/RUNTIME_FEDERATION_2026-05-28.md).

## Responsibility

Assess empirical / scientific claims against evidence, methodology, replication, and uncertainty. Produces validation records carrying explicit confidence and lineage.

## Non-responsibilities

Does **not** own:

- the claim entity → `runtime-knowledge-graph`
- identity / namespace → `runtime-hkd-registry`
- runtime trust state → `hemant-core` (HSTS state words)
- enforcement → vacant (future `runtime-governance`)

> **Important separation from HSTS.** `hemant-core` HSTS encodes runtime trust gates (e.g. `HSTS_NETWORK_SSL_ENFORCED`). This runtime assesses *claim* validity. The two must not be conflated and HSTS primitives must not be re-implemented here.

## Authority

Owns: validation records per claim. Never the claim, the registry, or the trust state.

## Dependencies

`@maataa/runtime-knowledge-graph` (claim refs), `@maataa/runtime-hkd-registry` (evidence artifact ids), `hemant-core` (time).

## Evidence

`ValidationRecord` shape:
`{ claimRef, methodology, evidence: [{ref, weight}], confidence: 0..1, uncertainty: { epistemic, aleatoric }, moderationState, replicationCount, ts }`. Append-only.

## Rollback

Append-only. New validations supersede prior ones but never delete history.

## Honest non-claims

- No validation records exist.
- Confidence and uncertainty scores are contractual intent, not calibrated.
- Replication counts are zero and unmeasured.
- This runtime cannot say "X is true." It can only emit assessed records with explicit uncertainty and moderation state.
