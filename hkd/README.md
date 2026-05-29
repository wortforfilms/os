# `hkd/` — Visual HKD extractions

PHKD-governed extractions from MAATAA OS vision boards.

## Status

**Phase 1 extraction complete for 18 vision boards.** Subsequent phases (HKD → knowledge graph ingestion, runtime suggestion application, reality-matrix computation against real repo state, CI gate on claim re-validation) are pending.

`STATUS = GOVERNED_PRODUCTION_NO_GO` (unchanged repo-wide). The extraction does not change the gate — it makes the gap between vision and reality auditable.

## Aggregate signal (across all 44 files, verified + absorbed 2026-05-29)

| Metric | Count |
|---|---|
| `.hkd` files | **44** |
| Sections | 528 |
| Nodes | 750 |
| Edges | 127 |
| Widgets | 201 |
| Claims | 495 |
| Evidence records | 107 |
| Claims BLOCKED | **376** (76%) |
| Claims PARTIAL | 59 (12%) |
| Claims UNVERIFIED | 60 (12%) |
| Claims VALIDATED | **0** (the HKD type system forbids it; downstream concern) |
| Nodes with confidence < 0.5 | **553 / 750 (74%)** |

**Known shape variance** (2026-05-29): `status-matrix-universe.hkd` was re-extracted by a different operator and carries 3 `HKDEdge` entries whose `from`/`to` point at section IDs rather than node IDs (e.g. `sec-reality-matrix → sec-reality-score-formula relation: FEEDS_SCORE_FORMULA`). This is a section-to-section semantic that the `VisualHKD` type doesn't formally express. The file parses, claims are absorbed; the edges show up as "dangling" in strict verifiers. Worth a future spec extension (allow `from/to` to reference sections too, or introduce a `HKDSectionEdge`).

The 299 BLOCKED claims and 80% sub-0.5-confidence nodes are the honest measure of the vision-to-reality gap. They are not failures of the extraction — they are the extraction succeeding at telling the truth about what the boards claim versus what the repo implements.

## Absorbed into the PHKD gate (`scripts/evidence-generate.mjs`)

`scripts/evidence-generate.mjs` was patched 2026-05-28 to read every `.hkd` file in this directory and emit each `BLOCKED` claim as a `blocker` in `COMPLETION_STATUS_MATRIX.json` and `release/evidence/blockers.json`. Run state after wiring:

```
$ node scripts/evidence-generate.mjs
evidence generated: CONTROLLED_NO_GO
blockers: 377 (routes: 0, features: 0, hardening: 1, hkd: 376)
hkd: 44 files / 495 claims (BLOCKED 376, PARTIAL 59, UNVERIFIED 60)
```

The matrix gate behaved correctly: `finalStatus` stayed `CONTROLLED_NO_GO`, `phkdVerdict: BLOCKED`. The 376 fabricated-metric claims from the boards are now traceable line items in the official PHKD evidence chain rather than narrative on rendered pages.

`completion.hkdSummary` carries the per-board breakdown for downstream consumers (per-file BLOCKED/PARTIAL/UNVERIFIED counts, universe tag, low-confidence node tally). `UNVERIFIED` and `PARTIAL` claims are *not* counted as blockers — they're honest open questions that don't fail the gate but are visible in the summary.

### Notable cross-board inconsistencies surfaced by extraction

- Mission Universe board claims **`Lives Impacted: 54.2M+`** while Time / Evolution Universe board claims **`Lives Impacted: 98.7M+`** — both share the same `Last Updated: May 17, 2025 08:45 AM`. Internal contradiction across boards with identical timestamps.
- Mission Universe says **`7 missions`** but only 6 mission cards are visible on the board.

## What lives here

`.hkd` files are JSON conforming to the `VisualHKD` type in
[`packages/visual-hkd-runtime/src/types.ts`](../packages/visual-hkd-runtime/src/types.ts).
The shape is intentionally PHKD-shaped:

- `HKDClaim.status` is restricted to `"UNVERIFIED" | "PARTIAL" | "BLOCKED"`. The HKD layer **cannot emit "VALIDATED"** — validation is a downstream concern (Phase 6, scientific evidence registry).
- `VisualHKDValidationResult.productionReady: false` is a *literal type* — anything that produces a validation result cannot lie about production-readiness at the type level.
- Every `HKDNode`, `HKDEdge`, `HKDWidget`, `HKDClaim`, `HKDEvidence` carries `sourceImage` + `confidence`. Provenance is built into the type, not an optional decoration.

## Files

| File | Source board | Status |
|---|---|---|
| `runtime-universe.hkd` | Runtime Universe (13 runtime cards) | `vision` |
| `workflow-universe.hkd` | All Runtimes • All Workflows • One Divine Ecosystem | `vision` |
| `service-universe.hkd` | All Services • One Ecosystem • Infinite Ecosystem | `vision` |
| `feature-universe.hkd` | All Features (19 categories) | `vision` |
| `product-universe.hkd` | All Products of Maataa OS (~50 -Mate products in 11 categories) | `vision` |
| `sku-universe.hkd` | All SKUs of Maataa OS (24 editions) | `vision` |
| `dashboard-universe.hkd` | All Dashboards of Maataa OS (30 dashboards) | `vision` |
| `deployment-operations-universe.hkd` | Deployment & Operations Universe | `vision` |
| `ecosystem-interconnection-universe.hkd` | Ecosystem Interconnection Map (16 brands) | `vision` |
| `marketplace-universe.hkd` | Marketplace & Revenue Engine | `vision` |
| `status-matrix-universe.hkd` | Status Matrix / Reality Matrix | `vision` |
| `scientific-evidence-universe.hkd` | Scientific Evidence Registry Universe | `vision` |
| `usp-universe.hkd` | 25 Unique Selling Propositions | `vision` |
| `worlds-firsts-universe.hkd` | 25 World's First Innovations | `vision` |
| `scientific-firsts-universe.hkd` | 25 World's Scientific Firsts | `vision` |
| `hero-module-universe.hkd` | Hero Module Overview (12 numbered modules) | `vision` |
| `landing-welcome.hkd` | Welcome to Maataa OS hero landing | `vision` |
| `landing-sovereign-ai.hkd` | Sovereign AI Operating System landing | `vision` |
| `mission-universe.hkd` | Mission Universe (7 Grand Missions, Impact Dashboard, Roadmap) | `vision` |
| `time-evolution-universe.hkd` | Time / Evolution Universe (7 Dimensions of Time, Continuum, Evolution Paths) | `vision` |
| `agent-universe.hkd` | Agent Universe (Orchestrator + 12 agents, marketplace, memory) | `vision` |
| `research-universe.hkd` | Research Universe (Question→Impact lifecycle, Knowledge Graph, EI Framework) | `vision` |
| `civilization-graph-universe.hkd` | Civilization Graph (7 Levels × 8 Dimensions, Civ Health Index) | `vision` |
| `consciousness-evolution-universe.hkd` | Consciousness Evolution (8 dimensions, 6-stage path) | `vision` |
| `identity-personhood-universe.hkd` | Identity & Personhood (MAATAA ID, Roles, Reputation, Privacy) | `vision` |
| `legacy-universe.hkd` | Legacy Universe (Journey, 7 Pillars, LIS 92.4, Inheritance Map) | `vision` |
| `reality-to-mission-traceability-universe.hkd` | Reality-to-Mission Traceability (9-Level Stack: Mission→Reality) | `vision` |
| `master-meta-map.hkd` | Master Meta Map (12 Primary Universes, 7 Chains, 5 Dharmic Pillars) | `vision` |
| `brahmini-chain-universe.hkd` | Brahmini Chain (7-layer chain, DPoS, BRC tokenomics) | `vision` |
| `lipi-script-universe.hkd` | Lipi & Script (6 families, script evolution timeline) | `vision` |
| `health-saptadhaatu-universe.hkd` | Health & Saptadhaatu (7 Dhatus, 3 Doshas, Ayurveda framework) | `vision` |
| `simulation-universe.hkd` | Simulation Universe (8 categories, sample worlds, lifecycle) | `vision` |
| `spatial-universe.hkd` | Spatial Universe (7 spatial layers, sacred network) | `vision` |
| `dharma-values-universe.hkd` | Dharma & Values (12 Lights, alignment scorecard, action areas) | `vision` |
| `financial-universe.hkd` | Financial Universe (8 instruments, capital flow, value chain) | `vision` |
| `ai-model-universe.hkd` | AI Model Universe (6 model categories, lifecycle, responsible-AI) | `vision` |
| `governance-universe.hkd` | Governance Universe (5-tier pyramid, policy lifecycle, alignment check) | `vision` |
| `education-gurukul-universe.hkd` | Education & Gurukul (5 pathways Jnana/Bhakti/Karma/Raja/Seva, 6 modes) | `vision` |
| `knowledge-graph-universe.hkd` | Knowledge Graph (10 graph categories, 13 relation types, NL queries) | `vision` |
| `hkd-runtime-universe.hkd` | **HKD Runtime Universe** — meta-board for the .hkd format itself; many PARTIAL claims since visual-hkd-runtime is real | `vision` |
| `data-schemas-universe.hkd` | Data Schemas & Databases (7 DBs, ERD, migrations, backup) | `vision` |
| `user-journeys-universe.hkd` | All User Journeys (18 journey types from Student to Media House) | `vision` |
| `asset-library-universe.hkd` | Asset Library (20 libraries, 125K+ assets, 120+ formats) | `vision` |
| `expanded-universe-absorption.hkd` | Expanded Maataa OS Universe Absorption Batch (Community & Society / Creator Economy / Media Broadcasting / ... source-missing placeholders) | `vision` |

### What was found in the wild — top BLOCKED categories

- **Fabricated metrics**: `Users 10K+ / 108K+ / 248,731+`, `GMV $12.48M+`, `Revenue $4.27M+`, `Transactions 125,642+`, `Services Running 1,842`, `Uptime 99.99%`, `EQS 76/100`, `Reality Score 44.2%`, `Last Updated <fabricated timestamp>`. All BLOCKED.
- **Fake-100%**: `100% Sovereign`, `100% Sovereign & Private By Design`, `100% Sovereign Offline First Private Secure`. All BLOCKED per PHKD principle 3.
- **Fake attestation / compliance**: `SOC 2 Type II Compliant`, `ISO 27001 Compliant`, `GDPR Compliant`, `HIPAA Compliant`, `PCI DSS Compliant`. All BLOCKED (no auditor reports).
- **"World's First" superlatives** (50 cards across 2 boards): all BLOCKED unless paired with peer-reviewed prior-art evidence and reproducible benchmarks (none provided).
- **Self-citation as evidence**: CLM-002 ("Maataa Research 2024") and CLM-008 ("Maataa Education 2024") on Scientific Evidence Registry. BLOCKED — directive: "claims must carry provenance, trust state, review lineage."
- **Self-asserted live data**: "Live Activity" feeds with "Just Now" timestamps, live availability maps with 99.99%, fabricated cost-spend breakdowns. All BLOCKED.

### Top PARTIAL claims (real things, but overclaimed)

- **Lipi runtime** (`@maataa/lipi-runtime`) — exists with substantial code (registry, lineage, learning, governance), but its own README declares `PRODUCTION_READY=false / PHKD_VERDICT=BLOCKED / FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO`. So "STATUS: ACTIVE" on the Runtime Universe board overclaims even the package's own honest self-status.
- **Knowledge runtime** — `@maataa/kbs-runtime` is real and substantial (claims/graph/governance/moderation/review/search/provenance/observability). The board's `@maataa/knowledge-runtime` name-mismatches it.
- **HKD enabler** — `visual-hkd-runtime` is real, but its scope is vision-board extraction, not the "universal knowledge format" the ecosystem board implies.
- **Knowledge Graph OS** — `kbs-graph` exists as a facade over `kbs-runtime/src/graph/`. "Thousands of sources" overclaims actual ingestion.

### Top UNVERIFIED (plausible, no evidence either way)

- Architectural sections like "Service Architecture: Clients → API Gateway → Service Mesh → Data Layer + Event Bus" — coherent design intent, no implementation.
- "Data Sovereignty: User Owned, Encrypted" — design property, not enforced.
- Maataa quotes and Sanskrit shlokas — cultural / inspirational content, not falsifiable claims.

## Extraction protocol

For each board:

1. **Identify sections** — the rectangular panels with titles. Each becomes an `HKDSection` with a `type` chosen from `runtime | service | feature | dashboard | workflow | data | evidence`.
2. **Identify nodes** — every labelled thing inside a panel (a runtime card, a service icon, an integration badge). Each becomes an `HKDNode` with `kind` and the section it lives in. `confidence` reflects how confident the extraction is that the label is correct *and* that the thing exists.
3. **Identify edges** — depicted relations (arrows, "owns" lines, ecosystem flows). Each becomes an `HKDEdge` with a `relation` string.
4. **Identify widgets** — composite UI elements (a STATUS panel, a card grid, a graph diagram, a timeline). Each becomes an `HKDWidget` with `widgetType` and a `MatrixStatus`. Widgets that depict claims-without-evidence (e.g. "Live Activity" feeds) take `status: "blocked"`.
5. **Identify claims** — every assertive statement on the board ("System: Online", "1,842 Services", "Production Ready", "10K+ Users", "GMV $12.48M"). Each becomes an `HKDClaim`:
   - `status: "UNVERIFIED"` — claim is plausible but has no evidence pointer.
   - `status: "PARTIAL"` — claim is partly backed by repo evidence (e.g. the package exists but doesn't match the board's exact wording).
   - `status: "BLOCKED"` — claim is contradicted by repo evidence, or the underlying runtime / data source does not exist.
6. **Identify evidence** — what *would* validate each claim, plus the operator-note trail of how the extraction was done. The source image itself is one `HKDEvidence` record.

## Validation honesty

- **Sub-0.7 confidence stays uncertain.** Per `visual-hkd-runtime`'s README guardrails.
- **"UNREADABLE is never guessed."** If text on the board is illegible, the field is omitted from the HKD; it is not filled with a guess.
- **STATUS badges on the board are CLAIMS, not facts.** "STATUS: ACTIVE" on a runtime card is captured as an `HKDClaim` and reconciled against `ls packages/`. If the package doesn't exist by that name, the claim is `BLOCKED`. If it exists but its own README declares `PRODUCTION_READY=false`, the claim is `PARTIAL`.
- **Decorative timestamps** like "Last Sync: Just Now" are `BLOCKED` until a real sync engine emits a real timestamp.
- **No claim is auto-promoted.** Moving a claim from `UNVERIFIED → PARTIAL → VALIDATED` requires an evidence trail produced by `runtime-validation` / `kbs-runtime/src/claims/`, not by the HKD layer.

## How to extract another board (recipe)

1. Add the board image as input (the file path goes in `sourceImage`).
2. Read it manually — no OCR in this sandbox; mark `evidence` as `operator_note`.
3. Validate every named package / runtime / service against `ls packages/` and the repo tree.
4. Write a new `.hkd` file following `runtime-universe.hkd`'s shape.
5. Update the table above.

## What this does NOT do (yet)

- Run through `visual-hkd-runtime`'s `generateVisualHKD()` function — that takes a `VisualExtractionInput` produced by a real vision pipeline. The current `.hkd` files are *manually authored conforming JSON* to demonstrate the shape and provide downstream inputs (e.g. for `ingestVisualHKDToGraph`).
- Get ingested into the knowledge graph yet (`graph-ingestor.ts` exists in `visual-hkd-runtime`; wiring it to consume these `.hkd` files is a separate step).
- Produce reality-matrix entries or runtime suggestions yet (the corresponding functions in `visual-hkd-runtime` are present but unwired in this workflow).

## Roadmap (advisory, not committed)

- Extract the remaining 16+ vision boards using the same protocol.
- Wire `ingestVisualHKDToGraph` to pull `.hkd` files into the existing `kbs-graph`.
- Wire `generateRealityMatrixEntries` so the Status Matrix board is *derived from* the HKDs, not *asserted against* them.
- Add a CI gate that re-validates every `.hkd` claim against the current `ls packages/` output, so the "BLOCKED" verdicts stay honest as packages land.
