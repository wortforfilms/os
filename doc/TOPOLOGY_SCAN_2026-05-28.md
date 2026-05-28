# MAATAA OS — Topology & Evidence Scan

- **Date:** 2026-05-28
- **Scope:** Read-only scan. No files modified. Evidence-first per PHKD directive.
- **Method:** Static inspection of the working tree at `tlps.in/maataa-os` (file
  reads + glob). The Linux sandbox could not mount the LaCie volume, so dynamic
  checks (`cargo check`, `smoke-alpha.sh`, QEMU boot) were **not executed**. All
  build/run claims below are read from source and docs, not verified by running.
- **Honest status (unchanged):** `CONTROLLED_CONVERGENCE / GOVERNED_PRODUCTION_NO_GO`

> Every finding cites the file it came from. Where a claim could not be verified
> by execution, it is marked **UNVERIFIED** rather than asserted.

---

## 1. Executive summary

The repository is **not** the federated PWA/runtime ecosystem the operating
directive models. On disk it is three loosely-related things sharing one folder:

1. **A real, honestly-documented QEMU embedded-OS alpha** (Rust, Cortex-M,
   Embassy) — `Cargo.toml`, `src/`, `crates/hemant-core`, `scripts/`, `doc/`.
   This part follows PHKD well: it has a smoke gate, host tests, a roadmap with
   honestly-unchecked items, and docs that state their own limits.

2. **A large, empty scaffold** of the aspirational ecosystem — `core/`, `apps/`,
   `offline-models/`, `packages/`, `resources/`. These trees contain
   **README placeholders only; no source files were found in them.**

3. **A static HTML mockup layer** — 42 pages, ~1.36 MB under `assets/html` +
   `core/renderer/html`. Mostly presentational (many pages have 0 interactive
   controls) and the project's own inventory flags broken dependencies.

The central PHKD tension: commit messages and one manifest use heavy
governance/sovereignty vocabulary ("certification gates", "attestation",
"governed release surfaces", "golden image pipeline", "1.0.0-gold"), but the
**verifiable substance** is a simulation-stage prototype plus empty directories
plus static HTML. The governance language describes dashboard frames, not
executing/enforcing runtimes.

**Bottom line:** `GOVERNED_PRODUCTION_NO_GO` is the correct status and the
evidence strongly supports it. "Controlled convergence" is true for the embedded
core; the wider ecosystem is **pre-convergence scaffolding**, not converging
runtimes.

---

## 2. Actual topology (what exists on disk)

| Zone | Path | What it actually is | State |
|---|---|---|---|
| Embedded firmware | `Cargo.toml`, `src/`, `memory.x`, `examples/demo_capsule` | Cortex-M `no_std` QEMU prototype (Embassy) | **Real, runs in QEMU** (per docs; UNVERIFIED here) |
| Time/state crate | `crates/hemant-core` | `no_std` monotonic epoch + HSTS state words, with unit tests | **Real + tested** |
| Desktop shell (Tauri) | `src-tauri/` + `node_modules` (React/Vite/TS) | Tauri desktop app, kept out of root Cargo workspace | Present |
| Desktop shell (Electron) | (per git history: "Add Electron desktop shell") | Second desktop host | Present |
| TS package | `packages/universal-runtime` | `package.json` pointing at `src/index.ts` | Near-empty stub |
| Ecosystem skeleton | `core/`, `apps/`, `offline-models/`, `resources/` | README-only directory tree | **Empty (no source)** |
| Static UI | `assets/html`, `core/renderer/html` | 42 HTML mockup pages | Mostly presentational |
| Docs | `doc/` and `docs/` | Two parallel documentation roots | Fragmented |

**Evidence:**
- `Cargo.toml` — `name = "maataa-os"`, `version = "0.1.0-alpha.1"`, workspace
  members `[".", "crates/hemant-core"]`, deps `cortex-m`, `embassy-executor`,
  `cortex-m-semihosting`.
- `src/main.rs` — `#![no_std] #![no_main]`, modules `capsule, drivers, ipc,
  kernel, log, storage`; entry boots and calls `kernel::run()`.
- `crates/hemant-core/Cargo.toml` — `version = "1.0.0-gold"`,
  `crates/hemant-core/src/lib.rs` — `pub mod hsts; pub mod time;` with `#[test]`
  monotonic/HSTS coverage.
- Glob of `core/ apps/ offline-models/ packages/ resources/` for
  `*.ts,*.tsx,*.js,*.rs,*.py,*.html,*.css` → **no source files** (README only).
- `docs/HTML_UI_INVENTORY.md` — 42 pages scanned, 1,359,545 bytes.

---

## 3. Topology drift vs the directive's "ideal shape"

### apps/
Directive ideal: `maataa, tlp, kbs, gurukul, kaa, cic, allb`.
Actual: `maataa, tlp, aadhyatmik, pedagogy, film, system`.

- Match: `maataa`, `tlp` (2 of 7).
- Missing: `kbs, gurukul, kaa, cic, allb` (5 of 7 absent).
- Extra/unmodeled: `aadhyatmik, pedagogy, film, system`.
- **All app directories are empty README placeholders.**

### packages/
Directive ideal: `runtime-core, runtime-auth, runtime-ui, runtime-observability,
runtime-governance, runtime-data, runtime-transport, runtime-release` (8 federated
runtimes).
Actual: `universal-runtime` only — and it is an empty stub.

- **Zero of the eight ideal runtime packages exist.**
- The single package is named `universal-runtime`. A "universal" runtime is in
  direct tension with PHKD principle 5 ("loosely coupled sovereign runtimes,
  NOT one giant app"). Naming alone signals convergence toward a monolith, not a
  federation.

### release/
- **Absent.** No `release/` directory, no `.github/` workflows, no CI config
  found. (Consistent with `doc/ROADMAP.md` Phase 5 marking "CI smoke checks" as
  unchecked.)

---

## 4. Dependency & authority cycles

### Source cycles
- The real Rust workspace is small and acyclic:
  `main → kernel → {drivers, storage, capsule, ipc, log}`; `hemant-core` is a
  leaf. No source cycles observed.
- **Caveat:** "0 source cycles" is currently true partly because most declared
  "runtimes" contain **no source at all**. The metric is not yet meaningful as a
  sign of healthy federation — there is little code to form cycles.

### Authority overlap (PHKD AUTHORITY RULE)
| Authority | Owner(s) found | Concern |
|---|---|---|
| Desktop host | **Tauri shell** (`src-tauri/`) **and** Electron shell (git: "Add Electron desktop shell") | Two runtimes claim the desktop-host role. Overlap — pick one owner or document the split. |
| Time / "truth" of clock | `hemant-core` ("Hemant Samwat" monotonic epoch) | Single-owned. OK, but it is a custom time authority — keep it the only one. |
| Release / "golden" authority | Dashboard frames + scripts (git: "golden image pipeline", "certification promotion gates", "production hardening gate matrix", "governed runtime release surfaces") | These are **presentational/UI**, not an executing governance runtime. Authority is described, not enforced. |
| Governance / moderation / telemetry | No dedicated runtime package | Directive requires governance that "executes, audits, rolls back, enforces". Not present as a runtime. |

**Finding:** the most material authority issue is not a *cycle* but a *vacuum*:
governance/release authority is narrated in commits and HTML, but no runtime
actually owns and enforces it. Per the directive, this overlap-of-narrative must
be documented and converged carefully, never presented as done.

---

## 5. Governance & evidence infrastructure

### Present and genuinely PHKD-aligned (keep these)
- `scripts/smoke-alpha.sh` — real release gate: clean target → `cargo check`
  (thumbv7em) → host tests → release build → size check → QEMU boot.
- `scripts/test-host.sh`, `scripts/sizecheck.sh` — host unit tests + size check.
- `doc/ROADMAP.md` — Phases 2–5 honestly unchecked (hardware, storage/WASM,
  security model, production/CI).
- `doc/ARCHITECTURE.md`, `doc/RELEASE_NOTES.md` — explicit "Known Limits" /
  "Future Architecture" sections; do not overclaim.
- `docs/HTML_UI_INVENTORY.md` — a generated evidence artifact that flags its own
  problems (missing SDK, Cloudflare snippets, CDN deps). Good evidence hygiene.

### Missing (required by directive, not present)
- **CI:** no `.github/` workflows / CI integrity enforcement.
- **release/ evidence directory:** no exported evidence, no release signatures.
- **Rollback drills:** none found.
- **Governance runtime:** no package that executes/audits/enforces/rolls back.

### Stale / drifting evidence
- `doc/RELEASE_NOTES.md` states *"The project directory is not currently a Git
  repository."* — but `.git/` exists with **38+ commits** (`vidhaan-tech
  <x.vidhaan.tech@gmail.com>`, first commit ~2026-05-25). The note was not
  updated after git init → evidence-lineage drift.
- `doc/` and `docs/` are two parallel doc roots → fragmentation; converge.

### Static UI quality flags (from `docs/HTML_UI_INVENTORY.md`)
- **68** references to `/_sdk/...` that do not exist in the repo
  (`missing-local-sdk`) → broken local dependencies.
- **29** pages contain copied Cloudflare challenge snippets — the inventory says
  these "should be stripped before release use."
- **34** pages depend on Tailwind via CDN → contradicts the directive's
  "offline capability" requirement.
- Many pages report **0 UI controls** (e.g. `dashboard.html`: 25 frames / 0
  controls; `monitor.html`: 17 / 0). These read as **decorative mockups**, which
  conflicts with "UI is NOT decoration / every screen is an operational surface."

---

## 6. Honest status vs claims (PHKD principles 1 & 3)

| Claim (and where) | Evidence reality | Verdict |
|---|---|---|
| QEMU alpha boots, virtual drivers, scheduler sim, host tests (`RELEASE_NOTES`, `ROADMAP` Phase 1) | Source + scripts present and self-consistent | **Plausible / honest** (UNVERIFIED by run here) |
| `hemant-core` = `1.0.0-gold` (`crates/hemant-core/Cargo.toml`) | Real `no_std` time/HSTS code with tests, but tiny; rest of repo is `0.1.0-alpha.1` | **Version label overclaims.** "gold" implies finished/100% — a fake-100% smell. Recommend `0.1.0-alpha.1` to match the workspace. |
| "WASM engine (wasmi), memory isolation, secure boot, capsule verification, capability-based API" (`doc/SYSTEM_MANIFEST.md`) | `ARCHITECTURE.md` says scheduler is *simulated*, isolation is *accounting only, not MPU-backed*, capsule layer *does not execute WASM*; `ROADMAP` Phase 4 security is **entirely unchecked** | **Overclaim. SYSTEM_MANIFEST contradicts ARCHITECTURE + ROADMAP.** Must be reworded to match reality. |
| "certification / attestation / sovereign / governed release surfaces" (git history, dashboards) | Implemented as UI frames + scripts, not enforcing runtimes | **Narrative, not evidence.** Do not present as complete. Directive: "never fake attestation." |
| Federated runtime ecosystem (directive ideal) | 1 empty package + empty app/core skeletons | **Aspirational, not built.** |

---

## 7. Recommendations (ordered, rollback-safe, no rewrites)

1. **Reconcile the manifest with reality (cheap, high integrity).** Rewrite
   `doc/SYSTEM_MANIFEST.md` so security/WASM/isolation claims match
   `ARCHITECTURE.md` + `ROADMAP.md` (i.e. "planned / simulated / accounting-only",
   not "operational"). This is the single most directive-violating artifact.
2. **Fix the `gold` version label.** Set `crates/hemant-core` to
   `0.1.0-alpha.1` (or justify "gold" with a signed evidence record). Avoid
   fake-100% labels.
3. **Update stale evidence.** Correct the "not a Git repository" line in
   `RELEASE_NOTES.md`; merge `doc/` and `docs/` into one root.
4. **Decide desktop-host authority.** Tauri *or* Electron owns the desktop host;
   document the decision and deprecate the other, or document the split openly.
5. **Quarantine the static UI honestly.** Mark `assets/html` as
   "mockups / non-operational" until the missing `/_sdk/` is real; strip the 29
   Cloudflare snippets before any release; remove CDN deps to honor offline-first.
6. **Either build or label the skeleton.** The empty `apps/*` and `packages/*`
   trees should carry a visible `STATUS: scaffold-only` marker so they are never
   mistaken for runtimes. Build the first real runtime package behind a facade
   rather than filling all directories at once.
7. **Stand up minimal CI before claiming "CI-enforced integrity."** A single
   workflow running `smoke-alpha.sh` would convert a roadmap promise into
   evidence. Until then, leave Phase 5 honestly unchecked.
8. **Verify by execution.** Re-run this scan in an environment where the volume
   mounts, then actually run `./scripts/smoke-alpha.sh` to upgrade the embedded
   alpha claims from "plausible" to "verified."

---

## 8. Scan limitations (fail-closed disclosure)

- The embedded build/boot was **not executed** (sandbox could not mount the
  volume). All "works/boots" claims are read from source/docs, not verified.
- `node_modules/`, `target/`, and `.git/objects` were not deep-inspected.
- Authority findings are from source layout, `Cargo.toml` workspace membership,
  and commit messages — not from a running dependency graph tool.
- This report is itself **evidence, not a release gate.** It does not move the
  status; status remains `GOVERNED_PRODUCTION_NO_GO`.
