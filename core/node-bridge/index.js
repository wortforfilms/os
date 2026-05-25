import { createVirtualFileSystem } from "./fs/index.js";
import { createMessageBus } from "./ipc/index.js";
import { getSystemSnapshot } from "./system/index.js";

export function createNodeBridge() {
  return {
    fs: createVirtualFileSystem(),
    ipc: createMessageBus(),
    system: getSystemSnapshot(),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(createNodeBridge().system, null, 2));
}
