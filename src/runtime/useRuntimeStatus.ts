import { useEffect, useState } from "react";
import {
  readRuntimeEventsSince,
  transportStateFromBatch,
  type RuntimeEvent,
  type RuntimeTransportState,
} from "./transport";

export type RuntimeStatusSnapshot = {
  state: RuntimeTransportState;
  cursor: number;
  lastHeartbeatAt: number | null;
  recentEvents: RuntimeEvent[];
  blockedSystemsCount: number;
  transport: "electron-ipc" | "browser-fallback" | "none";
};

const initialSnapshot: RuntimeStatusSnapshot = {
  state: "OFFLINE",
  cursor: 0,
  lastHeartbeatAt: null,
  recentEvents: [],
  blockedSystemsCount: 0,
  transport: "none",
};

export function useRuntimeStatus(pollMs = 2500): RuntimeStatusSnapshot {
  const [snapshot, setSnapshot] = useState<RuntimeStatusSnapshot>(initialSnapshot);

  useEffect(() => {
    let cancelled = false;
    let cursor = 0;

    async function tick(): Promise<void> {
      try {
        const batch = await readRuntimeEventsSince(cursor);
        cursor = batch.cursor;
        if (cancelled) {
          return;
        }
        setSnapshot((previous) => {
          const events = [...batch.events, ...previous.recentEvents].slice(0, 6);
          return {
            state: transportStateFromBatch(batch),
            cursor: batch.cursor,
            lastHeartbeatAt: events.find((event) => event.type === "heartbeat")?.at ?? previous.lastHeartbeatAt,
            recentEvents: events,
            blockedSystemsCount: batch.blockedSystemsCount,
            transport: batch.transport,
          };
        });
      } catch {
        if (!cancelled) {
          setSnapshot((previous) => ({ ...previous, state: "BLOCKED", transport: "none" }));
        }
      }
    }

    tick();
    const interval = window.setInterval(tick, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [pollMs]);

  return snapshot;
}
