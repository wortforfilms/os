# System

Internal Maataa OS utilities and runtime-facing UI modules.

Promoted modules:

- `KernelDashboard`: kernel health, drivers, capsules, and memory summary.
- `SystemMonitor`: live runtime metrics and event stream.
- `CapsuleRegistry`: loaded capsule table and lifecycle state.
- `ProcessTable`: scheduler/process table.
- `BootTimeline`: boot sequence and release-smoke flow.
- `RuntimeConsole`: QEMU/semihosting logs and command output.
- `MemoryMap`: FLASH/RAM/capsule memory regions.

See `modules/moduleRegistry.ts` for the source HTML frames and layout intent
used to promote each module.
