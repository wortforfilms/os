# MAATAA OS — Runtime Federation Proposal

- **Date:** 2026-05-28
- **Scope:** Introduce five runtimes into the federation in PHKD-compliant
  shape. **Topology-first.** No runtime is built before authority and
  dependency are resolved on paper.
- **Status of this proposal:** `PROPOSED / SCAFFOLD-ONLY / AUTHORITY_OVERLAP_UNRESOLVED`.
  Nothing in this document moves MAATAA OS off `GOVERNED_PRODUCTION_NO_GO`.
- **Companion artifact:** `doc/TOPOLOGY_SCAN_2026-05-28.md` (current baseline).

> **Correction banner.** The original package inventory used by the first
> half of this document was incomplete. The authoritative correction is
> `doc/TOPOLOGY_SCAN_2026-05-28_CORRECTION.md`; see also §8 below. Treat
> the five new runtime packages as scaffold-only overlap markers until the
> named pre-existing owners are reconciled.

> This is a planning document. Every runtime named here lands as a
> scaffold-only package whose facade methods return
> `{isOk:false, error:{code:'not_implemented'}}` and whose `health()` reports
> `status: 'scaffold'`. Nothing fakes implementation.

---

## 1. The five new runtimes (and the rename)

| User-supplied name | Federation name (runtime-* convention) |
|---|---|
| Knowledge Graph Runtime | `@maataa/runtime-knowledge-graph` |
| HKD Registry Runtime | `@maataa/runtime-hkd-registry` |
| Reality-to-Mission Runtime | `@maataa/runtime-mission` |
| Runtime Observatory | `@maataa/runtime-observability` |
| Scientific Validation Runtime | `@maataa/runtime-validation` |

---

## 2. Overlap & authority resolution (PHKD AUTHORITY RULE)

The directive forbids multiple runtimes silently owning truth, release,
moderation, telemetry, or trust. Before any scaffolding, every authority is
named and assigned to exactly one owner. Overlaps are documented, not hidden.

| Authority | Owner | Notes |
|---|---|---|
| Monotonic time / epoch | `crates/hemant-core` (existing) | Single owner. Untouched. |
| Runtime trust gates (HSTS state words) | `crates/hemant-core` (existing) | Single owner. **Not** to be re-implemented by `runtime-validation`. |
| Identity / namespace / version pins / signatures | `runtime-hkd-registry` | **New owner.** No existing authority. Source of truth for HKD-canonical artifacts. |
| Typed entity & relation graph | `runtime-knowledge-graph` | **New owner.** Does not own claim validity or identity. |
| Scientific / empirical claim validity | `runtime-validation` | **New owner.** Distinct from HSTS (which is system-trust, not claim-truth). |
| Mission-vs-reality drift (read-only) | `runtime-mission` | **New owner.** Reports drift; never enforces. |
| Health / metrics / topology / lineage aggregation | `runtime-observability` | **New owner.** Read-only collector. Adopts the directive's `runtime-observability` slot. |
| Page theming + page-local KV | `assets/_sdk/element_sdk.js`, `data_sdk.js` (existing) | **Must not** be conflated with `runtime-knowledge-graph` or `runtime-hkd-registry`. Local-only, presentational scope. |
| Embedded kernel / drivers / capsule / storage | root `maataa-os` crate (existing) | Untouched by this proposal. |
| Desktop host | Tauri shell + Electron shell (existing **overlap**) | Pre-existing unresolved overlap from prior scan. **Not** resolved here. |
| Governance enforcement | (vacant) | `runtime-governance` is not in this batch. `runtime-mission` produces governance candidates; nothing enforces them yet. **Documented vacuum.** |
| Moderation execution | (vacant) | Same — documented vacuum. |
| Release authority | (vacant — narrated only) | Per prior scan; unchanged. |

### Overlap flags called out explicitly

1. **Runtime Observatory ≡ directive's `runtime-observability`** — same
   responsibility, same name slot. We adopt the directive's slot. No second
   observatory.
2. **Knowledge Graph vs HKD Registry** — both touch the knowledge layer. Hard
   line: Registry owns *identity of artifacts*; KG owns *relations between
   entities*. KG entities reference Registry ids; Registry never reads KG.
3. **Scientific Validation vs hemant-core HSTS** — both produce
   "verified/not-verified" signals. Hard line: HSTS = runtime trust state
   machine for the embedded kernel (e.g. `HSTS_NETWORK_SSL_ENFORCED`).
   Validation = scientific/empirical claim assessment. `runtime-validation`
   must not import or shadow HSTS primitives.
4. **Reality-to-Mission vs (future) `runtime-governance`** — mission
   *measures and proposes*; governance *enforces*. Until `runtime-governance`
   exists, mission output is read-only evidence with no enforcement path. This
   is honest, not a regression.
5. **Knowledge Graph vs `data_sdk.js`** — `data_sdk` is page-local
   `localStorage`. It is **not** the federation's knowledge store and must
   never be marketed as such. Its `__meta` already says so.

---

## 3. Dependency topology

Acyclic. All flows point downward toward `hemant-core`.

```
                     runtime-observability   (read-only collector)
                          ▲   ▲   ▲   ▲
                          │   │   │   │ (reads .health())
              ┌───────────┘   │   │   └────────────┐
              │       ┌───────┘   └────────┐       │
              │       │                    │       │
       runtime-mission│            runtime-validation
              │       │                    │
              │       │                    │
              ▼       ▼                    ▼
              runtime-knowledge-graph ─────┘
                          │
                          ▼
                  runtime-hkd-registry
                          │
                          ▼
                      hemant-core
                   (time + HSTS state)
```

### Cycle check (proposed graph)

- `runtime-observability` reads `health()` from every other runtime. Nothing
  reads back into observability. **No cycle.**
- `runtime-mission` reads from KG + validation + observability. None of those
  read mission. **No cycle.**
- `runtime-validation` reads KG + registry. Neither reads validation.
  **No cycle.**
- `runtime-knowledge-graph` reads registry (entity-type ids). Registry does
  not read KG. **No cycle.**
- `runtime-hkd-registry` reads `hemant-core`. `hemant-core` reads nothing.
  **No cycle.**

Total: **0 dependency cycles** in the proposed federation.

### Authority overlap check

- Each authority row in §2 has exactly one owner.
- Vacancies are listed and labeled "documented vacuum" rather than
  silently assigned.
- **0 silent authority overlaps** in the proposed federation. The pre-existing
  Tauri/Electron desktop-host overlap remains; this proposal does not touch it.

---

## 4. Per-runtime one-pagers

Each runtime ships at scaffold stage with: a package manifest, a thin
facade returning fail-closed `not_implemented` results, an observable
`health()` that reports scaffold state, a README naming responsibility and
non-responsibility, and a rollback path. No runtime is presented as
functional.

---

### 4.1 `runtime-observability` (Runtime Observatory)

- **Responsibility.** Read-only aggregation of `health()`, topology, and
  lineage signals exposed by every other federation runtime. Presents the
  observability fabric.
- **Non-responsibilities.** Does not own moderation, release, governance,
  time, identity, or any underlying state. Never writes into observed
  runtimes.
- **Authority boundary.** Owns the aggregated observability view; the
  observed runtimes own their own health.
- **Deterministic contract (proposed).**
  - `collect(targets: HealthTarget[]) -> Promise<Result<AggregatedHealth>>`
  - `getTopology() -> Promise<Result<TopologyGraph>>`
  - `getLineage(eventId) -> Promise<Result<LineageRecord>>`
  - `health() -> HealthReport`
- **Dependencies.** Reads `health()` from every other runtime. No upward
  dependencies. Acyclic.
- **Observable surface.** `health()` reports `lastCollectionTs`,
  `sourcesObserved`, `degraded`. Collection log is append-only.
- **Evidence.** Each collection emits an immutable record with source health
  digests and time from `hemant-core`.
- **Governance hooks.** Collection scope (which runtimes are observed) is
  resolved through `runtime-hkd-registry` once it exists. Until then the
  scope is `[]` and `health()` reports `scope: 'unresolved'`.
- **Rollback.** Pure data. Removing the package removes the view; observed
  runtimes are unaffected.

---

### 4.2 `runtime-knowledge-graph`

- **Responsibility.** Typed entity + relation store. Owns "what is connected
  to what" in the MAATAA semantic graph.
- **Non-responsibilities.** Does **not** own claim validity (that is
  `runtime-validation`), identity / namespace / signature (that is
  `runtime-hkd-registry`), enforcement (vacant), or static page-local KV
  (that is `data_sdk.js`).
- **Authority boundary.** Owns the relation set and entity-type schema.
  Entity ids are minted by `runtime-hkd-registry` when canonical, or local
  if uncanonical (clearly marked).
- **Deterministic contract (proposed).**
  - `defineEntityType(spec) -> Promise<Result<{typeId}>>`
  - `addEntity(typeId, payload) -> Promise<Result<{id}>>`
  - `addRelation(from, type, to, evidenceRef?) -> Promise<Result<{edgeId}>>`
  - `query(pattern) -> Promise<Result<Match[]>>`
  - `health() -> HealthReport`
- **Dependencies.** `runtime-hkd-registry` (entity-type identity),
  `hemant-core` (time). Read-only towards both.
- **Observable surface.** `health()` reports `entityTypeCount`,
  `entityCount`, `edgeCount`, `lastWriteTs`.
- **Evidence.** Every edge optionally carries an `evidenceRef` pointing to a
  `runtime-hkd-registry` artifact id or a `runtime-validation` record id.
  Edges without provenance are stored as `moderationState: 'proposed'`.
- **Governance hooks.** Edge moderation state machine:
  `proposed → reviewed → accepted | rejected`. Transitions emit events.
- **Rollback.** Append-only snapshots with revision pins. Rollback = restore
  to a Registry-pinned snapshot id. No destructive deletes.

---

### 4.3 `runtime-hkd-registry` (HKD Registry)

- **Responsibility.** Identity, namespace, version-pin, and signature
  authority for HKD-canonical artifacts — registered runtimes, apps,
  capsules, evidence files, trust roots.
- **Non-responsibilities.** Does not own graph relations, claim validity,
  mission state, or enforcement. Does **not** own user identity (that
  belongs to a future `runtime-auth`).
- **Authority boundary.** Single source of truth for HKD identity.
  `name → artifact@version → signature → trust chain`.
- **Deterministic contract (proposed).**
  - `register(spec: ArtifactSpec) -> Promise<Result<{id, version, signature}>>`
  - `resolve(name, version?) -> Promise<Result<Artifact>>`
  - `list(filter?) -> Promise<Result<Artifact[]>>`
  - `pin(id, version) -> Promise<Result<{pinId}>>` (immutable, append-only)
  - `verify(id) -> Promise<Result<{signatureValid, trustChain: 'enforced' | 'advisory' | 'unverified'}>>`
  - `health() -> HealthReport`
- **Dependencies.** `hemant-core` only (time + HSTS for trust-state
  determination). Leaf otherwise.
- **Observable surface.** `health()` reports `artifactCount`, `pinCount`,
  `revocationCount`, `trustState`.
- **Evidence.** Append-only ledger: every registration entry carries
  `(id, version, prevHash, signature, registrant, ts)`. Revocations are
  recorded, never silently deleted.
- **Governance hooks.** Registration policy + revocation list. Policy is
  loaded from a pinned policy artifact (self-hosted in the registry).
- **Rollback.** Append-only. Rollback = pin to a prior version; history is
  never erased. PHKD-aligned by construction.

---

### 4.4 `runtime-mission` (Reality-to-Mission)

- **Responsibility.** Compare a declared mission state against observed
  reality and emit drift signals plus advisory converging actions.
- **Non-responsibilities.** Does **not** enforce. Does not modify other
  runtimes. Does not own truth — it reports drift; future
  `runtime-governance` enforces.
- **Authority boundary.** Owns mission specs and drift records. Read-only
  against everything else.
- **Deterministic contract (proposed).**
  - `declareMission(spec) -> Promise<Result<{missionId}>>`
  - `assess(missionId) -> Promise<Result<DriftReport>>`
  - `propose(missionId) -> Promise<Result<ProposedActions>>` (advisory only)
  - `health() -> HealthReport`
- **Dependencies.** `runtime-knowledge-graph`, `runtime-validation`,
  `runtime-observability`, `hemant-core`. All read-only.
- **Observable surface.** `health()` reports `missionCount`,
  `lastAssessmentTs`, `driftSummary`.
- **Evidence.** Each `assess()` emits an immutable `DriftReport` with
  observed-state digest, declared-state digest, drift items with confidence
  and lineage references into KG / validation / observability.
- **Governance hooks.** `propose()` output is emitted as governance
  *candidates* tagged `enforcement: 'none — runtime-governance vacant'`
  until a governance runtime owns the enforcement path.
- **Rollback.** Mission specs are deletable; drift reports stay as evidence.

---

### 4.5 `runtime-validation` (Scientific Validation)

- **Responsibility.** Assess empirical/scientific claims against evidence,
  methodology, replication, and uncertainty. Produces validation records
  with explicit confidence and lineage.
- **Non-responsibilities.** Does **not** own the claim entity (KG does),
  identity (registry does), or runtime trust state (`hemant-core` HSTS does).
- **Authority boundary.** Owns validation records per claim. Never the
  claim, the registry, or the trust state.
- **Deterministic contract (proposed).**
  - `submitClaim(claimRef, evidence: Evidence[], methodology: MethodologySpec) -> Promise<Result<{validationId}>>`
  - `assess(validationId) -> Promise<Result<ValidationRecord>>`
  - `replicationStatus(validationId) -> Promise<Result<{replications, agreement}>>`
  - `health() -> HealthReport`
- **Dependencies.** `runtime-knowledge-graph` (claim refs),
  `runtime-hkd-registry` (evidence artifact ids), `hemant-core` (time).
- **Observable surface.** `health()` reports `claimCount`,
  `pendingAssessments`, `averageConfidence`.
- **Evidence.** `ValidationRecord` shape:
  `{ claimRef, methodology, evidence: [{ref, weight}], confidence: 0..1,
     uncertainty: { epistemic, aleatoric }, moderationState, replicationCount,
     ts }`. Append-only.
- **Governance hooks.** Moderation state machine; replication thresholds
  loaded from a registry-pinned policy artifact.
- **Rollback.** Append-only. New validations supersede prior ones but never
  delete history.

---

## 5. Cross-cutting contracts

### 5.1 Result envelope (shared shape, duplicated locally per package)

```
type Result<T> =
  | { isOk: true;  data: T;    error: null }
  | { isOk: false; data: null; error: { code: string; detail: string } };
```

Every facade method returns `Result<T>` (or `Promise<Result<T>>`). **No
method throws into the caller.** At scaffold stage every method returns
`{ isOk: false, data: null, error: { code: 'not_implemented', detail: 'scaffold-only' } }`.

### 5.2 Health envelope

```
type HealthReport = {
  runtime: string;
  version: string;
  status: 'scaffold' | 'degraded' | 'ready';
  initialized: boolean;
  capabilities: string[];
  evidence: {
    pendingOps: number;
    lastEventTs: number | null;
    notes: string[];
  };
  __meta: {
    reconstructed: boolean;
    governedProductionGo: false;
  };
};
```

### 5.3 Status convention

Every runtime package's manifest carries:

```
"maataa": {
  "runtime": true,
  "status": "scaffold-only",
  "authority": [ ... single-owner strings ... ],
  "dependsOn": [ ... package names ... ]
}
```

This makes authority and dependency machine-readable. A future
`runtime-observability` collector can walk `packages/*/package.json` and
build the federation map deterministically.

---

## 6. Status matrix delta

Adds five rows to the prior scan's matrix. All five enter as `PROPOSED /
SCAFFOLD-ONLY`. None affect the gate.

| Runtime | State | Authority owned | Dependencies | Evidence today |
|---|---|---|---|---|
| `runtime-observability` | **PROPOSED / SCAFFOLD-ONLY** | aggregated observability view | reads .health() of all others | `health()` reports scaffold |
| `runtime-knowledge-graph` | **PROPOSED / SCAFFOLD-ONLY** | typed relations + entity-type schema | `runtime-hkd-registry`, `hemant-core` | scaffold |
| `runtime-hkd-registry` | **PROPOSED / SCAFFOLD-ONLY** | identity, namespace, signatures, pins | `hemant-core` | scaffold |
| `runtime-mission` | **PROPOSED / SCAFFOLD-ONLY** | mission specs + drift records (read-only against others) | KG, validation, observability, `hemant-core` | scaffold |
| `runtime-validation` | **PROPOSED / SCAFFOLD-ONLY** | claim validation records | KG, registry, `hemant-core` | scaffold |

Overall MAATAA OS status unchanged:
**`CONTROLLED_CONVERGENCE / GOVERNED_PRODUCTION_NO_GO`**.

---

## 7. Limitations & honest non-claims

- This proposal is paper. No runtime here is implemented; scaffolds exist
  only to make the federation map visible and rollbackable.
- The directive's `runtime-core`, `runtime-auth`, `runtime-ui`,
  `runtime-data`, `runtime-transport`, `runtime-release`, and
  `runtime-governance` slots remain unfilled by this batch.
- The pre-existing Tauri/Electron desktop-host overlap is **not** resolved
  here.
- No CI workflow runs against these packages yet. They have type-shaped
  exports only; `node --check` / `tsc` was **not** executed (sandbox cannot
  mount the volume).
- "Append-only" and "signature" semantics described above are
  *contractual intent*, not implementation. Until backed by code + storage
  + key management, they are aspirational; the facades' `not_implemented`
  results are the honest current state.

---

## 8. AUTHORITY OVERLAP — UNRESOLVED (added 2026-05-28, post-correction)

> This section is a **correction**, not a plan. The §2 authority table
> above was authored against an incomplete view of `packages/`. After the
> LaCie volume re-mounted and the real package inventory was read, **five
> of this proposal's runtimes overlap with pre-existing owners.** See
> `doc/TOPOLOGY_SCAN_2026-05-28_CORRECTION.md` for the full evidence.

| Proposed runtime | Pre-existing owner that already owns this | Verdict | Suggested convergence (advisory) |
|---|---|---|---|
| `runtime-knowledge-graph` | `@maataa/kbs-graph` (facade over `kbs-runtime/src/graph/`) | **Direct overlap. Redundant.** | Collapse into `kbs-graph`, or rescope as a multi-graph aggregator (fuses kbs-graph + visual-hkd projections + lipi lineage). |
| `runtime-validation` | `kbs-runtime/src/claims/` + `@maataa/kbs-governance` (classifyClaim, freezeUnsupportedClaim, etc.) | **Direct overlap. Redundant.** | Collapse into `kbs-runtime/src/claims/` + `kbs-governance`, or rescope as scientific-method validation *above* claim classification. |
| `runtime-mission` | `@maataa/visual-hkd-runtime` already produces `RealityMatrixEntry[]` and `RuntimePackageSuggestion[]` | **Partial overlap.** | Rescope as the consumer/orchestrator of visual-hkd's reality-matrix. Visual-HKD **produces**, mission **interprets**. |
| `runtime-hkd-registry` | `@maataa/lipi-runtime` (script registry, narrow); `@maataa/visual-hkd-runtime` (HKD artifact production) | **Partial overlap.** | Rescope as the *general cross-runtime* identity / version-pin / signature registry that does not yet exist. Must not shadow Lipi's script registry or Visual-HKD's artifact production. |
| `runtime-observability` | `@maataa/maataa-ui/observatory/*` (Runtime Observatory UI); `@maataa/evidence-runtime` (evidence loader); `kbs-runtime/src/observability/` (KBS-internal) | **Three pre-existing owners.** | Rescope as a pure non-UI cross-runtime aggregator library that `maataa-ui` consumes, fed by `evidence-runtime`. Must not shadow existing owners. |

### Pre-existing overlaps the original scan **also** missed

- **Three observability owners** (`maataa-ui/observatory`, `evidence-runtime`,
  `kbs-runtime/src/observability/`) — violates the AUTHORITY RULE on
  telemetry. Needs explicit scope separation in writing.
- **Two governance scopes** (`kbs-governance` = claim-level;
  `maataa-ui/governance/` = UI surface). Desktop / release governance is
  still vacant.
- **Tight coupling** across the `kbs-*` facade family (relative-path
  imports like `../../kbs-runtime/src/...`). Facade by re-export, not by
  contract.

### Operating consequence

- None of the five new `runtime-*` packages leaves scaffold state until
  the overlap is reconciled.
- All five `health()` calls correctly report `status: "scaffold"` today —
  no overclaim.
- `STATUS = GOVERNED_PRODUCTION_NO_GO` is unchanged and remains the
  correct gate position.
