# Maataa OS UI Modules

The useful frames from `assets/html` are promoted into named system modules
under `apps/system/modules`.

## Modules

| Module | Purpose | Primary Source Frames |
| --- | --- | --- |
| `KernelDashboard` | Top-level kernel health, driver readiness, capsule totals, and memory pressure. | `assets/html/dashboard.html`, `assets/html/k8/kernel_dashboard.html` |
| `SystemMonitor` | Scheduler ticks, driver polling, power state, and runtime events. | `assets/html/monitor.html`, `assets/html/systemprocesses.html` |
| `CapsuleRegistry` | Loaded capsules, lifecycle state, byte usage, cycles, and capabilities. | `assets/html/gallery/maa_lang/os.html`, `assets/html/gallery/maa_lang/system_complete_product.html` |
| `ProcessTable` | Scheduler tasks, ownership, state, and ticks. | `assets/html/systemprocesses.html`, `assets/html/k8/intent.html` |
| `BootTimeline` | Boot sequence from reset through QEMU exit. | `assets/html/quick_start.html`, `assets/html/gallery/mahabharat_unified_timeline.html` |
| `RuntimeConsole` | QEMU output, semihosting logs, command output. | `assets/html/gallery/maa_lang/playground.html`, `assets/html/gallery/maa_lang/studio.html` |
| `MemoryMap` | FLASH, RAM, capsule budget, and logical storage regions. | `assets/html/gallery/maa_lang/system_architect.html`, `assets/html/os_holy_screen.html` |

## Promotion Rule

Raw HTML remains inventory/prototype material. The modules in `apps/system` are
the named surfaces that should receive real data from the QEMU alpha, host tools,
or future runtime APIs.

## Next Implementation Step

Attach these modules to an actual frontend runtime only after choosing the app
stack. Until then, keep them dependency-light and use the module registry as the
contract between HTML inventory and Maataa OS product surfaces.
