# Maataa OS Structure

This document captures the intended long-range repository shape. The current
released implementation remains the QEMU alpha kernel at the repository root.
The new directories are scaffolding for future runtime layers, applications,
offline models, and resources.

```text
maataa-os/
├── core/
│   ├── kernel/
│   ├── renderer/
│   ├── node-bridge/
│   ├── java-layer/
│   ├── python-ml/
│   └── wasm-layers/
├── apps/
│   ├── maataa/
│   ├── tlp/
│   ├── aadhyatmik/
│   ├── pedagogy/
│   ├── film/
│   └── system/
├── offline-models/
├── resources/
├── docs/
├── build/
└── scripts/
```

## Current Boundary

- The QEMU alpha release is built from the root Rust crate.
- `core/kernel/` documents the future home for the Rust kernel but does not
  duplicate or move the current working code yet.
- Renderer, bridge, Java, Python, WASM, app, model, and resource directories are
  placeholders until their build contracts are defined.
- Root `scripts/` contains both working alpha scripts and placeholder orchestration
  scripts for the future monorepo.
- `docs/SCAFFOLD.md` tracks the concrete entrypoints added for the full scaffold.
- `apps/electron/` now provides the heavier desktop isolation shell alongside
  the existing Tauri viewport.
- `packages/evidence-runtime/` owns the local 20-byte HST hardware telemetry
  frame parser used by pressure harnesses and cockpit proof panels.

## Multi-Tier Target Surface

The long-range `hemant-samwat/` topology is tracked as a target scaffold, not a
claim of full scientific certification:

```text
hemant-samwat/
├── .github/workflows/
├── apps/
│   ├── desktop/
│   ├── device-lab/
│   ├── electron/
│   ├── mobile/
│   ├── tauri/
│   ├── tlp-studios/
│   └── web-console/
├── crates/
│   ├── hemant-core/
│   ├── hemant-spice/
│   ├── hemant-ephemeris/
│   ├── hemant-astronomy/
│   ├── hemant-panchanga/
│   ├── hemant-validation/
│   ├── hemant-evidence/
│   ├── hemant-provenance/
│   ├── hemant-topology/
│   ├── hemant-security/
│   ├── hemant-reproducibility/
│   └── hemant-cli/
├── packages/
│   ├── evidence-runtime/
│   ├── maataa-ui/
│   ├── universal-runtime/
│   ├── celestial-runtime/
│   ├── cinematic-runtime/
│   ├── governance-runtime/
│   ├── live-space-runtime/
│   ├── observatory-runtime/
│   └── topology-runtime/
├── datasets/
├── evidence-runtime/
├── release/
├── scripts/
├── tests/
└── migrations/sqlite/
```

## Offline Machinery Hooks

- Offline LLM core: `crates/hemant-runtime/` target hook, staged.
- Visual media generation: `apps/device-lab/` target hook, staged.
- Workflow orchestration: `packages/cinematic-runtime/` target hook, staged.
- Local 3D generation: `packages/celestial-runtime/` target hook, staged.
- Mesh refinement: `apps/desktop/src-tauri/` target hook, staged.
- Procedural topology: `crates/hemant-topology/` target hook, staged.
- Browser 3D runtime: `packages/maataa-ui/` target hook, scaffolded.
- Local computer vision: `packages/live-space-runtime/` target hook, staged.
- Audio transform matrix: `apps/radio-vaigyaaniq/` target hook, staged.

`assets/html/` is a local-only prototype sandbox and must remain outside all
build, telemetry, evidence, and release packaging paths.

## Migration Rule

Move code into the broader tree only when its build and smoke tests can move with
it in the same change. The QEMU alpha gate must remain green during migration.
