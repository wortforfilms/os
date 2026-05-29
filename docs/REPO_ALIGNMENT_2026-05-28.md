# MAATAA OS — Target Structure Alignment

- **Date:** 2026-05-28 (a follow-up correction to `doc/TOPOLOGY_SCAN_2026-05-28.md` and its addendum).
- **Trigger:** Operator-supplied canonical target structure + 12-command map + 9-level PHKD status ladder + 10-step build order on 2026-05-28.
- **Honest preface:** the three prior 2026-05-28 audits I produced (`doc/TOPOLOGY_SCAN`, the correction addendum, and the runtime federation proposal) **all undercounted what is already on disk**. The pattern is the same each time: the LaCie volume mount flickered during a glob, I trusted the negative result, I asserted a directory was empty when it wasn't. This is the fourth occurrence. The rule recorded to long-term memory in `[[maataa-os-packages-inventory]]` now applies to the full repo, not just `packages/`: **probe every directory directly with `ls` before asserting absence on this volume.**

## 1. Adopting the PHKD status ladder

The operator's 9-level ladder is adopted as the canonical convention for every status statement in this repo going forward.

| Level | Meaning |
|---|---|
| `VISION_BOARD` | Image / mockup only. No structure yet. |
| `SPECIFIED` | HKD extracted (a `.hkd` file in this repo). |
| `SCAFFOLDED` | Package exists with manifest + facade + fail-closed health. |
| `IMPLEMENTED` | Working runtime code (tests may not yet cover it). |
| `TESTED` | Test coverage exists. |
| `VALIDATED` | Evidence-backed (real data, signed artifacts). |
| `DEPLOYED` | Live environment. |
| `OBSERVED` | Telemetry confirms behavior under load. |
| `GOVERNED` | Policy + audit + rollback + recovery ready. |

This matches the 10-column Status Matrix board (which adds *Imagined* and *Designed* before *Specified*) and the existing `HKDStatus` enum in `packages/visual-hkd-runtime/src/types.ts` (which covers the first 5 levels).

Two existing canonical scripts already gate state transitions:

- `scripts/evidence-generate.mjs` regenerates `COMPLETION_STATUS_MATRIX.json` (the operational matrix) on every run. The matrix tracks `route.state` per surface against an evidence string.
- `scripts/governed-production-gate.mjs` validates hardware-root-of-trust + release-authority evidence and emits one of `GOVERNED_PRODUCTION_GO | GOVERNED_RELEASE_CANDIDATE | GOVERNED_PRODUCTION_NO_GO`.

## 2. Target tree vs current state

### 2.1 `apps/`

| Target | Exists? | Note |
|---|---|---|
| `apps/web/` | **No (by name)** | Root `package.json` runs `vite --host 127.0.0.1` directly; the web shell is implicitly at root, not under `apps/web/`. |
| `apps/desktop/` | **No (by name)** | But `apps/electron/` is a real Electron shell + `src-tauri/` is a real Tauri crate. Desktop is split across two named hosts. |
| `apps/admin/` | **No (by name)** | But the active `COMPLETION_STATUS_MATRIX.json` lists `/admin` as a `PREVIEW_VERIFIED` route in `maataa-ui` with a role-guard. The admin surface exists; the `apps/admin/` directory does not. |
| `apps/mobile/` | **No** | Genuine gap. |
| **(plus existing)** | | `aadhyatmik`, `film`, `kbs`, `maataa`, `pedagogy`, `system`, `tlp` are domain-named apps that the new target tree does not enumerate. Confirm: rename to platform-named or keep both axes? |

### 2.2 `packages/`

| Target | Current state | Note |
|---|---|---|
| `maataa-ui` | **IMPLEMENTED** | Substantial (SovereignDashboard, observatory shells, governance UI, react 19, tsup). |
| `visual-hkd-runtime` | **IMPLEMENTED + TESTED** | Vision → HKD pipeline; `tests/visual-hkd-runtime.test.ts`; `npm run visual-hkd:verify`. |
| `kbs-runtime` | **IMPLEMENTED + TESTED** | Substantial monolith (`claims/`, `governance/`, `graph/`, `ingestion/`, `moderation/`, `observability/`, `provenance/`, `review/`, `search/`, `export/`); `tests/kbs/*.test.ts`. |
| `kbs-graph` | **IMPLEMENTED** (facade) | Re-exports from `kbs-runtime/src/graph/`. |
| `kbs-search` | **IMPLEMENTED** (facade) | |
| `kbs-governance` | **IMPLEMENTED** (facade) | |
| `evidence-runtime` | **IMPLEMENTED** (small) | `loadRuntimeObservatoryEvidence`. |
| `runtime-mission` | **SCAFFOLDED** (2026-05-28 by me) | Facade returns `not_implemented`. |
| `runtime-observability` | **SCAFFOLDED** (2026-05-28 by me) | Overlaps `maataa-ui/observatory/*` + `evidence-runtime` + `kbs-runtime/src/observability/` (documented in §8 of federation doc). |
| `runtime-hkd-registry` | **SCAFFOLDED** (2026-05-28 by me) | |
| `lipi-runtime` | **IMPLEMENTED + TESTED** | Publishable; `tests` (run via `npm run test:lipi`); prisma; tsup. |
| `avatar-runtime` | **VISION_BOARD only** | Not on disk. |
| `voice-runtime` | **VISION_BOARD only** | Not on disk. |
| `gesture-runtime` | **VISION_BOARD only** | Not on disk. |
| `chakra-runtime` | **VISION_BOARD only** | Not on disk. |
| `saptadhaatu-runtime` | **VISION_BOARD only** | Not on disk. |
| `brahmini-runtime` | **VISION_BOARD only** | Not on disk. |
| `tlp-runtime` | **VISION_BOARD only** | `apps/tlp/` exists (different concern: app shell, not runtime package). |
| `investorhub-runtime` | **VISION_BOARD only** | Not on disk. |
| `sovereign-runtime` | **VISION_BOARD only** | Conflicts naming with the root Rust embedded crate, which is often called the Sovereign Runtime in docs/UI. Resolve before scaffolding. |

**Existing packages not in the new target** that need a disposition decision:

| Package | Disposition |
|---|---|
| `kbs-sdk` | Has `python/` subdir + TS client + OpenAPI 3.1.0 spec. Useful — keep, or rename. |
| `universal-runtime` | Confirmed empty stub. Delete or fill. |
| `runtime-knowledge-graph` | Scaffolded by me 2026-05-28; redundant with `kbs-graph`. Per federation correction §8: collapse or rescope. |
| `runtime-validation` | Scaffolded by me 2026-05-28; redundant with `kbs-runtime/src/claims/` + `kbs-governance`. Per federation correction §8: collapse or rescope. |

### 2.3 `hkd/`

| Target | Current state | Note |
|---|---|---|
| `hkd/universe-boards/` | **Missing** | The 18 source images are not in repo (operator-supplied). |
| `hkd/extracted/` | **Wrong location** | My 18 `.hkd` files (created 2026-05-28) live at `hkd/*.hkd`, not `hkd/extracted/*.hkd`. **Easy to move.** |
| `hkd/registry/` | **Missing** | Should be derived by `runtime-hkd-registry` when implemented. |
| `hkd/validated/` | **Missing** | Should be derived by `runtime-validation` or `kbs-runtime/src/claims/` when wired. |
| **(plus existing)** | | `data/visual-hkd/` exists at the parallel location and is currently empty. Decide: `hkd/` at root *or* `data/visual-hkd/`. Two locations for the same concept is a topology hazard. |

### 2.4 `prisma/`, `data/`, `release/`, `docs/`, `scripts/`, `tests/`

| Target dir / file | Current state |
|---|---|
| `prisma/schema.prisma` | **Missing** at root. `lipi-runtime/prisma/` exists (domain-local). Centralize or keep per-runtime? |
| `prisma/migrations/`, `prisma/seed.ts` | Missing at root. `scripts/seed.mjs` and `scripts/db-migrate.mjs` are the existing equivalents. |
| `data/maataa.db` | Missing. No central SQLite store yet. |
| `data/evidence/` | Lives at `release/evidence/` (auto-populated by `scripts/evidence-generate.mjs`). |
| `data/assets/` | `assets/` exists at root (with `html/`, `_sdk/`, `manifest.json`, `demo.wasm`). |
| `data/knowledge/` | Missing. `kbs-runtime/src/data.ts` holds the in-package knowledge. |
| `data/status/` | Missing. `COMPLETION_STATUS_MATRIX.json` + `COMPLETION_STATUS_MATRIX.md` live at root. |
| `release/evidence/`, `release/reports/` | **Exist and are populated** (per `scripts/evidence-generate.mjs`). |
| `release/captures/`, `release/manifests/` | Missing. |
| `docs/ARCHITECTURE.md`, `STATUS_MATRIX.md`, `REALITY_MATRIX.md`, etc. (UPPERCASE filenames) | Mostly **missing under those exact names**, but lowercase + alternate naming exists: `docs/architecture.md`, `docs/STRUCTURE.md`, `docs/governed-production.md`, `docs/observatory.md`, `docs/runtime-states.md`, `docs/no-hallucination-policy.md`, `docs/visual-hkd-runtime.md`, `docs/release-authority.md`, `docs/rollback.md`. The two doc roots `doc/` (my work) and `docs/` (existing) are still parallel — merge required. |
| `scripts/extract-visual-hkd.ts` | **Missing.** This is genuinely a gap — there's `scripts/verify-visual-hkd-runtime.mjs` but no extract script. My 18 `.hkd` files were authored manually. |
| `scripts/generate-knowledge-graph.ts` | Missing. |
| `scripts/generate-status-matrix.ts` | Equivalent exists: `scripts/status-matrix.mjs` (4-line summarizer over `COMPLETION_STATUS_MATRIX.json`). |
| `scripts/generate-reality-matrix.ts` | Missing. |
| `scripts/verify-phkd.ts` | Equivalent exists: `scripts/check-phkd-status.sh`. |
| `scripts/verify-runtime-federation.ts` | Missing. |
| `scripts/build-release-evidence.ts` | Equivalent exists: `scripts/evidence-generate.mjs` (substantial, real, gates `GO` on zero blockers). |
| `tests/visual-hkd.test.ts` | Exists as `tests/visual-hkd-runtime.test.ts`. |
| `tests/kbs-runtime.test.ts` | Exists as `tests/kbs/*.test.ts`. |
| `tests/evidence-runtime.test.ts` | Missing. |
| `tests/mission-runtime.test.ts` | Missing. |
| `tests/observability-runtime.test.ts` | Missing. |
| `tests/phkd-governance.test.ts` | Equivalent exists: `tests/governed-production-gate.test.mjs`. |

### 2.5 Root infra files

| Target | Current state |
|---|---|
| `package.json` | Exists; well-developed (~80 scripts including `audit:phkd`, `govern:release`, `release:sign`, `hardware:attest`, full test matrix). |
| `pnpm-workspace.yaml` | Exists; `packages: ["packages/*"]`. |
| `turbo.json` | **Missing** (turbo not used; you may not need it). |
| `tsconfig.base.json` | **Missing**; per-package `tsconfig.json` files reference per-runtime configs. |

## 3. Command map vs current state

| Target command | Exists? | If yes, what it runs |
|---|---|---|
| `pnpm install` | Yes (`npm install` equivalent). | |
| `pnpm build` | Yes (`npm run build`). | `tsc && vite build`. |
| `pnpm test` | Yes (`npm test`). | Runs ~24 test suites + `cargo test --lib`. |
| `pnpm typecheck` | Yes. | `tsc --noEmit` plus per-package typechecks. |
| `pnpm visual-hkd:extract` | **No** | Real gap — only `visual-hkd:verify` exists today. |
| `pnpm visual-hkd:verify` | Yes. | `node scripts/verify-visual-hkd-runtime.mjs`. |
| `pnpm kbs:graph` | **No** | Only `kbs:verify` exists. |
| `pnpm evidence:generate` | Yes. | `node scripts/evidence-generate.mjs`. |
| `pnpm mission:trace` | **No** | Real gap. |
| `pnpm status:matrix` | Yes. | `node scripts/status-matrix.mjs`. |
| `pnpm reality:matrix` | **No** | Real gap. |
| `pnpm audit:phkd` | Yes. | `npm run evidence:generate && npm run status:matrix`. |

So **6 of 12** commands exist; **6** are new: `visual-hkd:extract`, `kbs:graph`, `mission:trace`, `reality:matrix`, plus implicit `verify-runtime-federation`.

## 4. Build order vs current state

| Step | Item | Real state today | Cheap-to-IMPLEMENTED |
|---|---|---|---|
| 1 | `visual-hkd-runtime` | **IMPLEMENTED + TESTED** (`tests/visual-hkd-runtime.test.ts`); ingestor + projection + reality-matrix + runtime-suggestion functions present. Awaiting VALIDATED. | Add `pnpm visual-hkd:extract` that drives `generateVisualHKD()` over an input dir. |
| 2 | `hkd-registry` | **SCAFFOLDED** (2026-05-28). | Implement append-only file-backed ledger using `hemant-core` time; defer signatures behind a `verify()` that reports `trustChain: "unverified"` until keys exist. |
| 3 | `kbs-runtime` + `kbs-graph` | **IMPLEMENTED + TESTED.** Already there. | Move to VALIDATED via `runtime-validation` integration. |
| 4 | `evidence-runtime` | **IMPLEMENTED** (small). | Extend to ingest the 18 `.hkd` files into `release/evidence/`. |
| 5 | `runtime-mission` | **SCAFFOLDED** (2026-05-28). | Implement `assess(missionId)` as a read-only consumer of `visual-hkd-runtime`'s `RealityMatrixEntry[]`. |
| 6 | `runtime-observability` | **SCAFFOLDED** (2026-05-28). | Rescope per federation-doc §8 to read-only aggregator that does **not** shadow `maataa-ui/observatory/*` or `evidence-runtime`. |
| 7 | Maataa Observatory dashboard | **IMPLEMENTED-ISH** (`maataa-ui/observatory/{RuntimeObservatory, EphemerisObservatory, UniversalObservatory, ObservatoryShell}`). | Add the `/runtime-observatory` route (currently `STAGED` per `COMPLETION_STATUS_MATRIX.json`). |
| 8 | Status / Reality matrix | **PARTIALLY DONE.** `COMPLETION_STATUS_MATRIX.json` is auto-generated daily by `evidence-generate.mjs` from `data/product-surface-matrix.json` + `release/reports/PRODUCTION_HARDENING_MATRIX.json`. **Reality matrix from the 18 `.hkd` files is NOT yet computed.** | Extend `evidence-generate.mjs` to read `hkd/*.hkd` and emit BLOCKED claims as additional blockers. Single high-leverage change. |
| 9 | Release evidence | **IMPLEMENTED-ISH.** `release/evidence/`, `release/reports/`, `release-authority/` real subsystems. | Add `release/captures/` and `release/manifests/` per target. |
| 10 | Governed deploy | **IMPLEMENTED-ISH.** `scripts/governed-production-gate.mjs`; hardware-root-of-trust capture; operator-quorum tests. | No change required for the structure; running it against the new evidence sources is the gate. |

## 5. Recommended next step

The single highest-leverage cheap action that builds on existing infrastructure rather than creating new:

> **Wire the 18 `.hkd` files into `scripts/evidence-generate.mjs` as an additional blocker source.**
>
> The script already aggregates blockers from `data/product-surface-matrix.json` (routes/features) and `release/reports/PRODUCTION_HARDENING_MATRIX.json` (hardening gates). Add a third source: read every `.hkd` (or relocate to `hkd/extracted/`), collect `claims` with `status: "BLOCKED"`, and emit them as `{ surface: hkdId, reason: claim.text + claim.blockedReason }`. The status matrix will then carry the vision-to-reality gap automatically.

This single change converts my Phase 1 HKD extraction work into a real input to the existing PHKD gate, and lights up the `audit:phkd` command with the 134 BLOCKED claims I extracted. No new commands required; no new runtimes; one file edited; gate behavior unchanged unless `BLOCKED` claims escalate `finalStatus` (they will: the matrix will move from CONTROLLED_NO_GO to … still NO_GO, but with 134 specific traceable evidence-needs instead of vague reasons).

### Then, in order of cheapness:

1. Move `hkd/*.hkd` to `hkd/extracted/*.hkd` (or `data/visual-hkd/`, your call) to match the target tree.
2. Add `pnpm visual-hkd:extract` script (`scripts/extract-visual-hkd.mjs`) that takes an input directory of images and produces `hkd/extracted/*.hkd` — automating what I did manually.
3. Implement `runtime-hkd-registry`'s append-only ledger (file-backed, hemant-core time, verify() reports `unverified` until keys exist).
4. Rescope `runtime-mission` and `runtime-observability` per federation §8 to avoid the overlap.
5. Merge `doc/` and `docs/` into one root.
6. Decide on `prisma/` centralization vs per-runtime.
7. Resolve `sovereign-runtime` naming collision with the root crate.
8. Build the 9 domain runtime packages (avatar, voice, gesture, chakra, saptadhaatu, brahmini, tlp, investorhub, sovereign) **last** — only after the federation primitives are honest.

## 6. Honest non-claims

- This document does not move `COMPLETION_STATUS_MATRIX.json`'s `finalStatus` from `CONTROLLED_NO_GO`.
- It does not validate any of the 134 BLOCKED `.hkd` claims; it routes them to the existing PHKD gate (recommended action above) but the gate's verdict remains `BLOCKED`.
- The 12-command map and 9-level status ladder are adopted as canonical convention. Existing scripts that already implement equivalents continue to work; new commands are added as aliases or implementations as the build order proceeds.
- The new target structure and the existing `docs/STRUCTURE.md` long-range `hemant-samwat/` topology are **not yet reconciled with each other**. Either the new target replaces the old or they are scoped to different time horizons — operator decision.
