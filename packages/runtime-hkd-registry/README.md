# @maataa/runtime-hkd-registry

**STATUS: scaffold-only. No runtime behavior yet. Every facade method returns `{ isOk: false, error: { code: "not_implemented" } }`. `health().status === "scaffold"`.**

> ## ⚠ AUTHORITY OVERLAP — PARTIAL
>
> Two narrower owners already exist in adjacent territory:
> - **`@maataa/lipi-runtime`** owns a 426-slot **script registry** with
>   lineage, characters, phonetics, learning paths, and governance.
> - **`@maataa/visual-hkd-runtime`** produces HKD **artifacts** (Visual
>   HKD records, knowledge-graph projections, runtime suggestions).
>
> A general *cross-runtime* HKD identity / version-pin / signature
> registry — the directive's "name → artifact@version → signature →
> trust chain" — does **not** yet exist. This is a genuine vacuum.
>
> Advisory convergence (not yet executed): rescope this runtime
> explicitly to the **general cross-runtime registry** role and document
> that it does **not** shadow Lipi's script registry (which is
> domain-specific) or Visual-HKD's artifact production (which is
> upstream of registration). With this rescope it is not redundant.
> Must not leave scaffold state until the boundary is formally
> documented. See `doc/TOPOLOGY_SCAN_2026-05-28_CORRECTION.md` and
> `doc/RUNTIME_FEDERATION_2026-05-28.md` §8.

Spec: [`doc/RUNTIME_FEDERATION_2026-05-28.md` §4.3](../../doc/RUNTIME_FEDERATION_2026-05-28.md).

## Responsibility

Identity, namespace, version-pin, and signature authority for HKD-canonical artifacts — registered runtimes, apps, capsules, evidence files, trust roots, policy artifacts.

## Non-responsibilities

Does **not** own:

- graph relations → `runtime-knowledge-graph`
- claim validity → `runtime-validation`
- mission state → `runtime-mission`
- enforcement → vacant (future `runtime-governance`)
- user identity → vacant (future `runtime-auth`)

## Authority

Owns: the single source of truth for HKD identity.
`name → artifact@version → signature → trust chain`.

## Dependencies

`hemant-core` only (time + HSTS for trust-state determination). Leaf otherwise.

## Evidence

Append-only ledger: every registration entry carries `(id, version, prevHash, signature, registrant, ts)`. Revocations are recorded, never silently deleted.

## Rollback

Append-only. Rollback = pin to a prior version; history is never erased. PHKD-aligned by construction.

## Honest non-claims

- No ledger storage, no key material, no signature verification.
- "Signature" and "append-only" are contractual intent only.
- Trust chain reports `unresolved` until `hemant-core` HSTS is wired and a registry policy is loaded.
- This is **not** user identity. Do not present it as account or auth infrastructure.
