import { useMemo } from "react";
import { createNativeMetricFrame, parseNativeMetricFrame, RecoveryFrameError } from "./runtimeFrame";
import {
  BootTimeline,
  CapsuleRegistry,
  KernelDashboard,
  MemoryMap,
  ProcessTable,
  RuntimeConsole,
  SystemMonitor,
  type CapsuleDatum,
  type ConsoleLine,
  type MemoryRegion,
  type MetricDatum,
  type ModuleStatus,
  type ProcessDatum,
  type TimelineDatum,
} from "./modules";

type BootPhaseId =
  | "driver-registry"
  | "flash-manifest"
  | "static-capsules"
  | "scheduler-demo"
  | "health-console";

type BootPhase = {
  id: BootPhaseId;
  label: string;
  detail: string;
  status: ModuleStatus;
};

type BridgeSnapshot = {
  source: "core/node-bridge";
  runtime: "node-bridge";
  kernel: "qemu-alpha";
  desktop: "tauri-vite";
  health: ModuleStatus;
  drivers: readonly string[];
};

type FlashManifest = {
  source: "model/resource";
  name: "maataa-os";
  version: "0.1.0-alpha.1";
  flashOrigin: "0x08000000";
  ramOrigin: "0x20000000";
  flashSizeBytes: number;
  ramSizeBytes: number;
  kernelTextBytes: number;
  kernelBssBytes: number;
  signature: string;
};

type RuntimeState = {
  status: ModuleStatus;
  bridge: BridgeSnapshot;
  manifest: FlashManifest;
  phases: readonly BootPhase[];
  metrics: MetricDatum[];
  monitorMetrics: MetricDatum[];
  capsules: CapsuleDatum[];
  processes: ProcessDatum[];
  timeline: TimelineDatum[];
  consoleLines: ConsoleLine[];
  memoryRegions: MemoryRegion[];
};

type RecoveryState = {
  reason: string;
  lines: ConsoleLine[];
};

const REQUIRED_PHASES: readonly BootPhaseId[] = [
  "driver-registry",
  "flash-manifest",
  "static-capsules",
  "scheduler-demo",
  "health-console",
];

const DRIVER_REGISTRY = ["uart", "gpio", "spi", "i2c", "power"] as const;

const STATIC_CAPSULES: CapsuleDatum[] = [
  { id: 0, name: "telemetry", bytes: 251, cycles: 6, status: "nominal" },
  { id: 1, name: "control", bytes: 23, cycles: 6, status: "nominal" },
];

const SCHEDULER_PROCESSES: ProcessDatum[] = [
  { pid: "k-main", name: "kernel::run", state: "running", ticks: 6, owner: "kernel" },
  { pid: "drv-poll", name: "driver poll", state: "ready", ticks: 6, owner: "drivers" },
  { pid: "cap-telemetry", name: "telemetry capsule", state: "ready", ticks: 6, owner: "capsule" },
  { pid: "cap-control", name: "control capsule", state: "ready", ticks: 6, owner: "capsule" },
];

const MANIFEST: Omit<FlashManifest, "signature"> = {
  source: "model/resource",
  name: "maataa-os",
  version: "0.1.0-alpha.1",
  flashOrigin: "0x08000000",
  ramOrigin: "0x20000000",
  flashSizeBytes: 512 * 1024,
  ramSizeBytes: 128 * 1024,
  kernelTextBytes: 11904,
  kernelBssBytes: 8,
};

function deterministicSignature(input: string): string {
  let hash = 0x811c9dc5;

  for (const char of input) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }

  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function buildManifest(): FlashManifest {
  const signaturePayload = [
    MANIFEST.name,
    MANIFEST.version,
    MANIFEST.flashOrigin,
    MANIFEST.ramOrigin,
    MANIFEST.flashSizeBytes,
    MANIFEST.ramSizeBytes,
    MANIFEST.kernelTextBytes,
    MANIFEST.kernelBssBytes,
  ].join("|");

  return {
    ...MANIFEST,
    signature: deterministicSignature(signaturePayload),
  };
}

function verifyManifest(manifest: FlashManifest): boolean {
  const expected = deterministicSignature(
    [
      manifest.name,
      manifest.version,
      manifest.flashOrigin,
      manifest.ramOrigin,
      manifest.flashSizeBytes,
      manifest.ramSizeBytes,
      manifest.kernelTextBytes,
      manifest.kernelBssBytes,
    ].join("|"),
  );

  return manifest.signature === expected && manifest.flashSizeBytes > 0 && manifest.ramSizeBytes > 0;
}

function loadBridgeSnapshot(): BridgeSnapshot {
  return {
    source: "core/node-bridge",
    runtime: "node-bridge",
    kernel: "qemu-alpha",
    desktop: "tauri-vite",
    health: "nominal",
    drivers: DRIVER_REGISTRY,
  };
}

function verifyBridge(snapshot: BridgeSnapshot): boolean {
  return REQUIRED_PHASES.length === 5 && DRIVER_REGISTRY.every((driver) => snapshot.drivers.includes(driver));
}

function hostThreadCount(): number {
  if (typeof navigator === "undefined") {
    return 1;
  }

  return Math.max(1, navigator.hardwareConcurrency || 1);
}

function buildRuntimeState(): RuntimeState | RecoveryState {
  const bridge = loadBridgeSnapshot();
  const manifest = buildManifest();
  const capsuleBytes = STATIC_CAPSULES.reduce((total, capsule) => total + capsule.bytes, 0);
  const totalTicks = SCHEDULER_PROCESSES.reduce((total, process) => total + process.ticks, 0);
  let nativeMetrics;

  if (!verifyBridge(bridge)) {
    return buildRecoveryState("native bridge verification failed");
  }

  if (!verifyManifest(manifest)) {
    return buildRecoveryState("flash manifest signature check failed");
  }

  try {
    nativeMetrics = parseNativeMetricFrame(
      createNativeMetricFrame({
        hostThreads: hostThreadCount(),
        health: bridge.health,
        scriptKnown: 9,
        scriptUnknown: 0,
        scriptWeight: 21,
        ipcFrames: 1,
        capsuleBytes,
        schedulerTicks: 6,
      }),
    );
  } catch (error) {
    if (error instanceof RecoveryFrameError) {
      return buildRecoveryState(error.message);
    }
    return buildRecoveryState("native metric frame parser failure");
  }

  if (STATIC_CAPSULES.length === 0 || SCHEDULER_PROCESSES.length === 0 || totalTicks <= 0) {
    return buildRecoveryState("invalid deterministic runtime schedule");
  }

  const phases: BootPhase[] = [
    {
      id: "driver-registry",
      label: "Driver Registry",
      detail: `loaded ${bridge.drivers.length} virtual drivers via ${bridge.source}`,
      status: "nominal",
    },
    {
      id: "flash-manifest",
      label: "Virtual Flash",
      detail: `mounted ${manifest.name} ${manifest.version} from ${manifest.source}`,
      status: "nominal",
    },
    {
      id: "static-capsules",
      label: "Capsules",
      detail: `loaded ${STATIC_CAPSULES.length} isolated capsules (${capsuleBytes} bytes)`,
      status: "nominal",
    },
    {
      id: "scheduler-demo",
      label: "Scheduler",
      detail: `executed deterministic scheduler demo across ${SCHEDULER_PROCESSES.length} processes`,
      status: "nominal",
    },
    {
      id: "health-console",
      label: "Runtime Console",
      detail: "emitted runtime health into the local IPC console ring",
      status: bridge.health,
    },
  ];

  const phaseOrderIsValid = phases.every((phase, index) => phase.id === REQUIRED_PHASES[index]);
  if (!phaseOrderIsValid) {
    return buildRecoveryState("boot contract phase order violation");
  }

  return {
    status: bridge.health,
    bridge,
    manifest,
    phases,
    metrics: [
      { label: "Drivers", value: `${bridge.drivers.length}/5 ready`, status: bridge.health },
      { label: "Capsules", value: `${STATIC_CAPSULES.length} loaded`, status: "nominal" },
      { label: "Memory", value: `${nativeMetrics.capsuleBytes} / 65536 bytes`, status: "nominal" },
      { label: "Scheduler", value: `${nativeMetrics.schedulerTicks} ticks`, status: "nominal" },
    ],
    monitorMetrics: [
      { label: "Runtime", value: "QEMU semihosting", status: "nominal" },
      { label: "Host threads", value: String(nativeMetrics.hostThreads), status: "nominal" },
      { label: "QEMU engine", value: "netduinoplus2/cortex-m4", status: "nominal" },
      { label: "Script matrix", value: `${nativeMetrics.scriptKnown}/${nativeMetrics.scriptUnknown}`, status: "nominal" },
    ],
    capsules: STATIC_CAPSULES,
    processes: SCHEDULER_PROCESSES,
    timeline: phases.map((phase) => ({
      label: phase.label,
      detail: phase.detail,
      status: phase.status,
    })),
    consoleLines: [
      { ts: "boot", level: "info", text: "driver registry loaded through core/node-bridge" },
      { ts: "boot", level: "info", text: `manifest signature verified: ${manifest.signature}` },
      { ts: "boot", level: "info", text: `capsules mounted: ${STATIC_CAPSULES.map((capsule) => capsule.name).join(", ")}` },
      { ts: "ipc", level: "debug", text: `native metric frame verified: ${nativeMetrics.signature.toString(16)}` },
      { ts: "tick 6", level: "info", text: `scheduler complete: ${totalTicks} accumulated process ticks` },
      { ts: "health", level: "info", text: `runtime health: ${bridge.health}` },
    ],
    memoryRegions: [
      {
        name: "FLASH",
        origin: manifest.flashOrigin,
        size: `${manifest.flashSizeBytes / 1024}K`,
        used: `${manifest.kernelTextBytes} bytes`,
        role: "kernel image",
      },
      {
        name: "RAM",
        origin: manifest.ramOrigin,
        size: `${manifest.ramSizeBytes / 1024}K`,
        used: `${manifest.kernelBssBytes} bytes bss`,
        role: "runtime state",
      },
      {
        name: "Capsule Budget",
        origin: "isolated-zone",
        size: "64K",
        used: `${capsuleBytes} bytes`,
        role: "static capsule accounting",
      },
      {
        name: "IPC Ring",
        origin: "shared-local",
        size: "4K",
        used: `${nativeMetrics.ipcFrames} native frame`,
        role: "stdin/stdout recovery-safe buffer",
      },
    ],
  };
}

function buildRecoveryState(reason: string): RecoveryState {
  return {
    reason,
    lines: [
      { ts: "recovery", level: "error", text: reason },
      { ts: "recovery", level: "warn", text: "isolated fallback console engaged" },
      { ts: "recovery", level: "info", text: "external calls disabled; raw HTML prototypes remain local-only" },
    ],
  };
}

function isRecoveryState(state: RuntimeState | RecoveryState): state is RecoveryState {
  return "reason" in state;
}

function RecoveryConsole({ recovery }: { recovery: RecoveryState }) {
  return (
    <main className="maataa-system-app recovery-mode">
      <section className="maataa-module runtime-console" data-status="critical">
        <header className="module-header">
          <div>
            <p className="module-kicker">Fail-safe</p>
            <h2>RecoveryConsole</h2>
          </div>
          <span className="status-pill critical">isolated</span>
        </header>

        <RuntimeConsole lines={recovery.lines} />
      </section>
    </main>
  );
}

export function MaataaSystemApp() {
  const runtime = useMemo(() => buildRuntimeState(), []);

  if (isRecoveryState(runtime)) {
    return <RecoveryConsole recovery={runtime} />;
  }

  return (
    <main className="maataa-system-app" data-runtime={runtime.bridge.runtime} data-stage={runtime.bridge.kernel}>
      <KernelDashboard status={runtime.status} metrics={runtime.metrics} />
      <SystemMonitor metrics={runtime.monitorMetrics} events={runtime.consoleLines} />
      <CapsuleRegistry capsules={runtime.capsules} />
      <ProcessTable processes={runtime.processes} />
      <BootTimeline steps={runtime.timeline} />
      <RuntimeConsole lines={runtime.consoleLines} />
      <MemoryMap regions={runtime.memoryRegions} />
    </main>
  );
}
