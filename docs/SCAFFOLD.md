# Full Scaffold

The repository now has concrete entrypoints for the planned Maataa OS surfaces:

- `apps/maataa/` for the mother interface, chakra, aura, sensors, and timeline.
- `apps/tlp/` for production dashboard, schedule, accounting, and vendors.
- `apps/system/` for QEMU alpha system modules rendered in Tauri.
- `core/node-bridge/` for filesystem, IPC, and system bridge contracts.
- `core/python-ml/` for the offline model registry package.
- `offline-models/model-manifest.json` for local model families.
- `resources/resource-manifest.json` for tracked and untracked resource policy.
- `assets/runtime/init` for the runtime bootstrap contract.

The scaffold rule is unchanged: placeholders should compile or remain inert, and
the QEMU alpha smoke test is the release gate.
