import { createVirtualFileSystem } from "./fs/index.js";
import { createMessageBus } from "./ipc/index.js";
import { getSystemSnapshot } from "./system/index.js";

export function createNodeBridge() {
  const fs = createVirtualFileSystem();
  const ipc = createMessageBus();
  const system = getSystemSnapshot();
  const metricsFrame = Buffer.from(JSON.stringify(system.metrics));

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
