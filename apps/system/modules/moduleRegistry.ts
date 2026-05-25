import type { UiModuleDefinition } from "./types";

export const MAATAA_OS_MODULES: UiModuleDefinition[] = [
  {
    id: "kernel-dashboard",
    name: "KernelDashboard",
    purpose: "Top-level kernel health, driver readiness, capsule totals, and memory pressure.",
    sourceFrames: [
      {
        path: "assets/html/dashboard.html",
        usefulFrames: ["dashboard", "card", "grid", "widget"],
        notes: "Best source for compact system status cards and dashboard density.",
      },
      {
        path: "assets/html/k8/kernel_dashboard.html",
        usefulFrames: ["dashboard", "toolbar", "panel"],
        notes: "Useful for kernel controls and readiness panels.",
      },
    ],
    dataFrames: ["health-summary", "driver-readiness", "capsule-summary", "memory-summary"],
    uiElements: ["status-card", "metric-grid", "health-pill", "run-control-toolbar"],
    layout: ["dashboard-grid", "compact-panels", "toolbar-top"],
  },
  {
    id: "system-monitor",
    name: "SystemMonitor",
    purpose: "Live monitor for scheduler ticks, driver polling, power state, and runtime events.",
    sourceFrames: [
      {
        path: "assets/html/monitor.html",
        usefulFrames: ["monitor", "grid", "card"],
        notes: "Strong source for live runtime telemetry blocks.",
      },
      {
        path: "assets/html/systemprocesses.html",
        usefulFrames: ["process", "panel", "timeline"],
        notes: "Useful event/process framing for runtime activity.",
      },
    ],
    dataFrames: ["event-stream", "driver-samples", "scheduler-ticks", "power-state"],
    uiElements: ["event-list", "metric-strip", "filter-tabs"],
    layout: ["two-column-monitor", "scrolling-log", "dense-grid"],
  },
  {
    id: "capsule-registry",
    name: "CapsuleRegistry",
    purpose: "List loaded capsules, lifecycle state, byte usage, cycle counts, and capabilities.",
    sourceFrames: [
      {
        path: "assets/html/gallery/maa_lang/os.html",
        usefulFrames: ["card", "table", "panel"],
        notes: "Good conceptual OS surface for registry and capability views.",
      },
      {
        path: "assets/html/gallery/maa_lang/system_complete_product.html",
        usefulFrames: ["card", "section", "grid"],
        notes: "Contains reusable product/module map patterns.",
      },
    ],
    dataFrames: ["capsule-table", "capability-list", "memory-usage", "lifecycle-state"],
    uiElements: ["table", "status-pill", "capability-chip", "details-panel"],
    layout: ["table-plus-detail", "module-grid"],
  },
  {
    id: "process-table",
    name: "ProcessTable",
    purpose: "Show scheduler tasks, ownership, current state, and accumulated ticks.",
    sourceFrames: [
      {
        path: "assets/html/systemprocesses.html",
        usefulFrames: ["process", "table", "panel"],
        notes: "Primary source for process/task UI concepts.",
      },
      {
        path: "assets/html/k8/intent.html",
        usefulFrames: ["form", "toolbar", "grid"],
        notes: "Useful for intent-driven process orchestration controls.",
      },
    ],
    dataFrames: ["process-table", "state-filter", "owner-filter", "tick-count"],
    uiElements: ["table", "segmented-filter", "toolbar"],
    layout: ["dense-table", "sticky-toolbar"],
  },
  {
    id: "boot-timeline",
    name: "BootTimeline",
    purpose: "Explain boot sequence from reset through driver init, storage mount, capsule load, and scheduler run.",
    sourceFrames: [
      {
        path: "assets/html/quick_start.html",
        usefulFrames: ["timeline", "card", "section"],
        notes: "Good onboarding flow and step-by-step layout.",
      },
      {
        path: "assets/html/gallery/mahabharat_unified_timeline.html",
        usefulFrames: ["timeline", "article"],
        notes: "Strong timeline visualization pattern.",
      },
    ],
    dataFrames: ["boot-step", "duration", "status", "log-anchor"],
    uiElements: ["timeline", "step-card", "status-dot"],
    layout: ["vertical-timeline", "progressive-disclosure"],
  },
  {
    id: "runtime-console",
    name: "RuntimeConsole",
    purpose: "Developer-facing console for QEMU output, semihosting logs, and command output.",
    sourceFrames: [
      {
        path: "assets/html/gallery/maa_lang/playground.html",
        usefulFrames: ["terminal", "form", "toolbar"],
        notes: "Best source for interactive playground/console patterns.",
      },
      {
        path: "assets/html/gallery/maa_lang/studio.html",
        usefulFrames: ["console", "toolbar", "panel"],
        notes: "Useful studio shell for command and inspector panels.",
      },
    ],
    dataFrames: ["console-line", "command-input", "log-filter", "session-state"],
    uiElements: ["terminal", "command-input", "copy-button", "level-filter"],
    layout: ["terminal-panel", "bottom-console"],
  },
  {
    id: "memory-map",
    name: "MemoryMap",
    purpose: "Visualize FLASH, RAM, capsule budget, and logical storage regions.",
    sourceFrames: [
      {
        path: "assets/html/gallery/maa_lang/system_architect.html",
        usefulFrames: ["canvas", "grid", "panel"],
        notes: "Good architecture visualization source.",
      },
      {
        path: "assets/html/os_holy_screen.html",
        usefulFrames: ["canvas", "card"],
        notes: "Useful visual language for a memory/energy map.",
      },
    ],
    dataFrames: ["memory-region", "region-usage", "origin-address", "role"],
    uiElements: ["memory-bar", "region-card", "legend", "address-label"],
    layout: ["diagram-left-detail-right", "stacked-memory-map"],
  },
];

export function findMaataaOsModule(id: string): UiModuleDefinition | undefined {
  return MAATAA_OS_MODULES.find((module) => module.id === id);
}
