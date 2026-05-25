import { defaultRuntimeSnapshot } from "../config";
import type { RuntimeSnapshot } from "../types";

export type RuntimeListener = (snapshot: RuntimeSnapshot) => void;

export class RuntimeStore {
  private snapshot: RuntimeSnapshot;
  private readonly listeners = new Set<RuntimeListener>();

  constructor(initialSnapshot: RuntimeSnapshot = defaultRuntimeSnapshot) {
    this.snapshot = initialSnapshot;
  }

  getSnapshot(): RuntimeSnapshot {
    return this.snapshot;
  }

  update(next: Partial<RuntimeSnapshot>): RuntimeSnapshot {
    this.snapshot = { ...this.snapshot, ...next };
    for (const listener of this.listeners) {
      listener(this.snapshot);
    }
    return this.snapshot;
  }

  subscribe(listener: RuntimeListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }
}

export const runtimeStore = new RuntimeStore();
