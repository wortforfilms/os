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

## Migration Rule

Move code into the broader tree only when its build and smoke tests can move with
it in the same change. The QEMU alpha gate must remain green during migration.
