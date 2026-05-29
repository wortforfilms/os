# MAATAA OS — Topology Scan Correction Addendum

- **Date:** 2026-05-28 (later in the day)
- **Amends:** `doc/TOPOLOGY_SCAN_2026-05-28.md` and `doc/RUNTIME_FEDERATION_2026-05-28.md`
- **Original scan preserved unchanged** as a historical artifact.
- **Status of MAATAA OS:** unchanged — `CONTROLLED_CONVERGENCE / GOVERNED_PRODUCTION_NO_GO`.

> This addendum exists because the original scan made a load-bearing
> evidence error. PHKD principle 1 (EVIDENCE BEFORE CLAIMS) is best served
> by correcting on the record, not by silently rewriting the prior doc.

---

## 1. What the original scan got wrong

The original scan asserted, in §2 and §5:

> "`packages/`: Actual: `universal-runtime` only — and it is an empty stub."
> "Zero of the eight ideal runtime packages exist."

This was **wrong**. The `packages/` directory holds **ten** pre-existing
packages, most of them with real source code, build configs, tests, and
PHKD-aligned READMEs. The scan missed them because the read-only
`Glob({core,apps,offline-models,packages,resources,src-tauri,crates,tests}/**/*.{ts,tsx,js,jsx,rs,py,html,css})`
returned "No files found" during a transient LaCie-volume mount flicker.
The same scan already noted that "negative globs are unreliable" in this
repo — and then trusted a negative glob anyway. Cause: I did not re-verify
the `packages/` result after the mount recovered.

The error is contained: it affected the topology / authority sections of
the scan and the entire `RUNTIME_FEDERATION_2026-05-28.md` proposal. The
embedded-firmware and SDK findings remain accurate.

---

## 2. The real `packages/` inventory (evidence-cited)

Each entry's evidence is `packages/<name>/src/index.ts` (or `package.json`
where noted). Read at 2026-05-28 with the volume re-mounted.

| Package | Real role (from src/index.ts) | Substance |
|---|---|---|
| `@maataa/kbs-runtime` | KBS core monolith. `src/index.ts` re-exports `types, data, runtime-board, ingestion, search, claims, graph, governance, provenance, review, moderation, observability, export`. | **Heavyweight.** Owns claims, provenance, moderation, review, governance, search, graph, observability, ingestion, export. The actual PHKD KBS. |
| `@maataa/kbs-graph` | Thin facade. `export { graphMetrics, traverseFrom, validateGraph } from "../../kbs-runtime/src/graph/index.ts"` + node/edge types. | Re-export of `kbs-runtime/src/graph/`. **Owns graph relations.** |
| `@maataa/kbs-governance` | Thin facade. Re-exports `detectContradictions, freezeUnsupportedClaim, classifyClaim, evaluateKbsGate, rejectProductionClaim, moderateClaim, enqueueReview, escalateReview` from `kbs-runtime`. | **Owns KBS claim governance + moderation + review.** Scope is claim-level governance, not desktop/release governance. |
| `@maataa/kbs-search` | Thin facade. Re-exports `citationSearch, keywordSearch, semanticSearch`. | Owns KBS search. |
| `@maataa/kbs-sdk` | Client SDK: `KbsTransport` interface, `createKbsClient(transport?)` with local fallback, `kbsOpenApiSpec` (OpenAPI 3.1.0). Has both `src/` and `python/` subdirs. | Owns the KBS client/server contract. |
| `@maataa/evidence-runtime` | `export * from "./loadRuntimeObservatoryEvidence"`. | Loads the Runtime Observatory's evidence. **Feeds observability.** |
| `@maataa/visual-hkd-runtime` | Vision-to-HKD pipeline. Modules: `image-loader, vision-extractor, panel-detector, text-extractor, icon-classifier, layout-parser, hkd-generator, graph-ingestor, runtime-generator, status-validator`. Exports `KnowledgeGraphProjection, RealityMatrixEntry[], RuntimePackageSuggestion[], VisualHKD`. README guardrails: "UNREADABLE never guessed", < 0.7 confidence stays uncertain, runtime suggestions default to scaffolded. | **Major package.** Already produces knowledge-graph projections, reality-matrix entries, and runtime suggestions. |
| `@maataa/maataa-ui` | Sovereign UI runtime. Subdirs include `SovereignDashboard.tsx`, `observatory/{RuntimeObservatory, EphemerisObservatory, UniversalObservatory, ObservatoryShell}`, `governance`, `telemetry`, `topology`, `accessibility`, `cinematic`, `celestial`, `ai`, `chakra`, `desktop`, `components`, `layouts`, `providers`, `hooks`. README: "Sovereign runtime UI scaffold for local-first Maataa OS surfaces." | **Owns UI runtime including Runtime Observatory UI surface.** Matches directive's `runtime-ui` slot. |
| `@maataa/lipi-runtime` | Lipi (script) civilization runtime. Modules: `types, registry, characters, phonetics, lineage, learning, search, governance, data`. README declares: 426-slot script registry matrix, character anchors, lineage graph edges, phonetic maps, Digital Gurukul learning paths, local search, governance evidence. README: `PRODUCTION_READY=false, PHKD_VERDICT=BLOCKED, FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO`. | **Major package.** Owns the script-civilization registry + lineage + learning + script-domain governance. Publishable (`"private": false`), has `prisma/`, `release/`, `tests/`, `tsup`. |
| `@maataa/universal-runtime` | One-file stub. | Confirmed empty (matches original scan). |

Pre-existing total: **10 packages**. New as of 2026-05-28: 5 (the
`runtime-*` scaffolds I added).

---

## 3. Authority map — corrected, evidence-based

Replaces §2 of `RUNTIME_FEDERATION_2026-05-28.md`. Each row backed by an
import or directory in the real package source.

| Authority | Actual owner today | Notes |
|---|---|---|
| Time / monotonic epoch | `crates/hemant-core` | Unchanged. |
| Runtime trust gates (HSTS) | `crates/hemant-core` | Unchanged. |
| KBS claims + provenance + moderation + review + governance + ingestion + export | `@maataa/kbs-runtime` | The actual KBS. Re-exported by facades below. |
| Knowledge graph relations | `@maataa/kbs-graph` (facade over `kbs-runtime/src/graph/`) | Existing owner. |
| KBS claim-level governance enforcement | `@maataa/kbs-governance` (facade over `kbs-runtime/src/governance/` + `moderation/` + `review/`) | Existing owner. The "governance vacuum" claimed by the original scan was **wrong for claim-level governance**. Desktop/release governance remains a vacuum. |
| KBS search | `@maataa/kbs-search` | Existing owner. |
| KBS client / OpenAPI surface | `@maataa/kbs-sdk` | Existing owner. |
| Vision → HKD → graph projection + reality-matrix entries + runtime suggestions | `@maataa/visual-hkd-runtime` | Existing owner. **Overlaps the `runtime-mission` and `runtime-hkd-registry` scopes I proposed.** |
| Runtime Observatory **evidence loader** | `@maataa/evidence-runtime` | Existing owner. |
| Runtime Observatory **UI surface** + Sovereign Dashboard + telemetry/topology UI + governance UI | `@maataa/maataa-ui` | Existing owner. Matches directive's `runtime-ui` slot. |
| Lipi (script) registry + lineage + Gurukul + script-domain governance evidence | `@maataa/lipi-runtime` | Existing owner. **A registry pattern, scoped to scripts.** |
| Embedded kernel / drivers / capsule / storage | root `maataa-os` crate | Unchanged. |
| Page theming + page-local KV | `assets/_sdk/element_sdk.js`, `data_sdk.js` | Unchanged. |
| Desktop host | Tauri shell + Electron shell (overlap) | Unchanged. |
| Desktop / release governance enforcement | (vacant — `kbs-governance` is claim-scoped, not release-scoped) | Still a vacuum. |
| General HKD identity / version-pin / signature registry across runtimes | (vacant — `visual-hkd-runtime` produces HKD artifacts, `lipi-runtime` registers scripts, but no general cross-runtime identity registry exists) | Still a vacuum. |

### New overlap risks introduced by my 5 scaffolds

| New scaffold | Conflicts with | Verdict |
|---|---|---|
| `runtime-knowledge-graph` | `kbs-graph` (already owns relations + facade over `kbs-runtime/src/graph/`) | **Direct overlap. Redundant unless rescoped to multi-graph aggregator or merged.** |
| `runtime-validation` | `kbs-runtime/src/claims/` + `kbs-governance` (classifyClaim, freezeUnsupportedClaim) | **Direct overlap.** Claim validation lives in `kbs-runtime` already. |
| `runtime-mission` | `visual-hkd-runtime` already produces `RealityMatrixEntry[]` + `RuntimePackageSuggestion[]` | **Partial overlap.** Reality-matrix and runtime suggestions exist; "mission spec → drift report → proposed actions" orchestration on top of them does **not** yet exist. Rescope mission as the consumer/orchestrator, not the originator. |
| `runtime-hkd-registry` | `lipi-runtime` registers scripts (narrow); `visual-hkd-runtime` produces HKD artifacts | **Partial overlap.** A general cross-runtime HKD identity + version-pin + signature registry is still a genuine vacuum. Rescope this one to **not** shadow Lipi's script registry or Visual-HKD's artifact production. |
| `runtime-observability` | `maataa-ui` owns Runtime Observatory UI; `evidence-runtime` loads its evidence; `kbs-runtime/src/observability/` exists too | **Partial overlap.** Three observability owners now (UI, evidence loader, KBS-internal). A general non-UI cross-runtime collector library could still be useful but must **not** shadow `maataa-ui`'s observatory or `evidence-runtime`. Rescope as a pure aggregator. |

### Authority overlaps that were **already present** (pre-existing, not introduced by this session)

These are pre-existing and the original scan also missed them:

- **Three observability owners.** `maataa-ui/observatory/*` (UI), `evidence-runtime` (evidence loader), and `kbs-runtime/src/observability/` (KBS-internal). Per the directive's AUTHORITY RULE: "Never allow multiple runtimes to silently own telemetry." Owners need explicit scope separation in writing.
- **Two "governance" owners with different scopes.** `kbs-governance` (claim-level: contradictions, classification, gating). `maataa-ui/governance/` (UI surface for governance state). No release/desktop governance owner anywhere. Document the scope split.
- **Tight coupling across the KBS facade family.** `kbs-graph`, `kbs-governance`, `kbs-search` all import via relative paths (`../../kbs-runtime/src/...`). That's facade-by-export, not facade-by-contract — the boundary is leaky. The directive's "convergence through facades, adapters, shims" is satisfied by name but not by isolation. Flag for hardening, not blocking.

---

## 4. Dependency graph — corrected

Real, observed (relative-import edges in `src/index.ts`):

```
                     maataa-ui (UI runtime)
                          │ uses
                          ▼
            evidence-runtime ──reads── (intended) ──> kbs-runtime / ... / observatory data
                                                     ▲
                                                     │ re-exports
                                ┌─── kbs-graph ──────┤
                                ├─── kbs-governance ─┤
                                ├─── kbs-search ─────┤
                                ├─── kbs-sdk ────────┤
                                                     │
                                                     ▼
                                              kbs-runtime
                                              (KBS monolith)

                visual-hkd-runtime  →  produces KnowledgeGraphProjection,
                                       RealityMatrixEntry[],
                                       RuntimePackageSuggestion[]
                                       (consumed by maataa-ui / kbs-runtime via ingestion;
                                        graph-ingestor.ts exists)

                lipi-runtime (independent; script registry + lineage + Gurukul)

                hemant-core (embedded leaf; existing alpha workspace, not yet
                            wired into the TS federation)

                root maataa-os crate (embedded firmware; separate)

                assets/_sdk/*.js  (page-local; separate)
```

### Cycle check (real)

- `kbs-graph`, `kbs-governance`, `kbs-search`, `kbs-sdk` all import from
  `kbs-runtime` via relative paths. `kbs-runtime` does not import them.
  **No cycle.**
- `evidence-runtime` references "RuntimeObservatory" by name; relationship
  to `kbs-runtime/src/observability/` and `maataa-ui/observatory/` is
  unverified at this read depth. **Possible coupling, not confirmed cycle.**
- `visual-hkd-runtime` is a producer; consumers ingest via
  `graph-ingestor.ts`. Direction outward. **No cycle.**
- `lipi-runtime` is independent.

Total observed: **0 confirmed cycles.** The "high semantic fragmentation"
flagged in the operating directive's current-topology block is real and
visible here: many small facades over one monolith plus several
independent runtimes with overlapping names.

### `hemant-core` and the TS federation are **not** wired together

`hemant-core` is a Rust `no_std` crate. None of the TS packages import it
or depend on its HSTS state words at runtime. The original federation
proposal assumed they would. They don't, today. The authority "time +
HSTS" lives on the embedded side and is **not currently consumed** by the
TS federation. This is a real gap, not a contradiction.

---

## 5. Implications for the five new `runtime-*` scaffolds

Per the user's choice 2026-05-28 ("keep both, document overlap loudly"):

1. The five scaffolds remain in `packages/runtime-*` and are
   **explicitly marked as overlapping** with the named pre-existing
   owners in their READMEs.
2. None of them is to leave scaffold state until convergence is
   negotiated. The current `health()` returns `status: "scaffold"` for
   all five — accurate.
3. Proposed convergence paths (advisory, not executed):
   - `runtime-knowledge-graph` — collapse into `kbs-graph` or rescope as
     a multi-graph aggregator (e.g. fuses `kbs-graph` + visual-hkd
     projections + lipi script lineage). Until decided: **redundant.**
   - `runtime-validation` — collapse into `kbs-runtime/src/claims/` +
     `kbs-governance`, or rescope to scientific-method validation that
     sits *above* claim classification. Until decided: **redundant.**
   - `runtime-mission` — rescope as the consumer/orchestrator of
     `visual-hkd-runtime`'s `RealityMatrixEntry[]` and
     `RuntimePackageSuggestion[]`. Document the boundary: visual-hkd
     **produces** the matrix, mission **interprets** it. Useful with
     this rescope.
   - `runtime-hkd-registry` — rescope to the **general cross-runtime
     identity registry** that does not yet exist, taking care not to
     shadow `lipi-runtime`'s script registry or `visual-hkd-runtime`'s
     artifact production. Useful with this rescope.
   - `runtime-observability` — rescope as a pure non-UI aggregator
     library that the existing `maataa-ui` observatory consumes, fed by
     `evidence-runtime`. Useful with this rescope, but must not shadow
     existing owners.

---

## 6. Status-matrix delta (correction)

| Item | Prior (incorrect) | Corrected |
|---|---|---|
| `packages/universal-runtime` | "only package; empty stub" | Correct, but **one of eleven**, not the only one. |
| `kbs-*` packages | absent from scan | Present and substantial; `kbs-runtime` owns the actual KBS. |
| `evidence-runtime`, `visual-hkd-runtime`, `maataa-ui`, `lipi-runtime` | absent from scan | All present and substantial. |
| Governance vacuum | "no runtime owns governance" | **Partly false.** `kbs-governance` owns claim-level governance. Release/desktop governance is still vacant. |
| Knowledge graph absent | implied | **False.** `kbs-graph` exists. |
| 5 new `runtime-*` scaffolds | clean federation | Internally clean, but **5 overlaps with pre-existing owners**, now documented in READMEs and federation doc §8 (forthcoming). |
| Overall status | `CONTROLLED_CONVERGENCE / GOVERNED_PRODUCTION_NO_GO` | Unchanged. |

---

## 7. Operating principle — what went wrong, and what changes

The methodology error was: **trusting a single negative `Glob`** on a
volume known to flicker. The corrective rule going forward (also saved
to long-term memory):

> Before asserting any package or directory is empty in this repo,
> probe it directly (`ls` or a known manifest `Read`). Negative globs
> on the LaCie mount are unreliable; mount flickers are a known fact.

The original `TOPOLOGY_SCAN_2026-05-28.md` remains on disk unmodified.
This addendum supersedes its `packages/` claims. Future readers should
treat this addendum as the authoritative `packages/` evidence, and the
original scan as historical context (embedded-firmware and SDK findings
in the original remain valid).
