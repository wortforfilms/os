import { createVirtualFileSystem } from "./fs/index.js";
import { createMessageBus } from "./ipc/index.js";
import { encodeNativeMetricFrame } from "./ipc/metric-frame.js";
import { getSystemSnapshot } from "./system/index.js";

export function createNodeBridge() {
  const fs = createVirtualFileSystem();
  const ipc = createMessageBus();
  const system = getSystemSnapshot();
  const metricsFrame = encodeNativeMetricFrame({
    hostThreads: system.metrics.threads,
    health: system.health,
    scriptKnown: 9,
    scriptUnknown: 0,
    scriptWeight: 21,
    ipcFrames: 1,
    capsuleBytes: 274,
    schedulerTicks: 6,
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
