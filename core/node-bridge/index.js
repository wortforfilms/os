import { createVirtualFileSystem } from "./fs/index.js";
import { createMessageBus } from "./ipc/index.js";
import { encodeNativeMetricFrame } from "./ipc/metric-frame.js";
import { getSystemSnapshot } from "./system/index.js";

export function createNodeBridge() {
  const fs = createVirtualFileSystem();
  const ipc = createMessageBus();
  const system = getSystemSnapshot();
  const metricsFrame = encodeNativeMetricFrame({
    uptimeTicks: 6,
    allocatedMemoryBytes: 274,
    activeTasks: 4,
    hardwareCores: system.metrics.threads,
    capsuleCount: 2,
    aiBatchStatus: 0x0009_0015,
  });

  fs.writeBinary("/runtime/metrics.frame", metricsFrame);
  ipc.writeFrame("runtime.metrics", metricsFrame);

  return {
    fs,
    ipc,
    system,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(createNodeBridge().system, null, 2));
}
