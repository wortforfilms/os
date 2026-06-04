import { useEffect, useState } from "react";
import {
  parseRuntimeSseData,
  readRuntimeEventsSince,
  resolveRuntimeSseUrl,
  transportStateFromBatch,
  type RuntimeEvent,
  type RuntimeTransport,
  type RuntimeTransportState,
} from "./transport";

export type RuntimeStatusSnapshot = {
  state: RuntimeTransportState;
  cursor: number;
  lastHeartbeatAt: number | null;
  recentEvents: RuntimeEvent[];
  blockedSystemsCount: number;
  transport: RuntimeTransport | "none";
  stream: "sse" | "polling" | "fallback";
};

const initialSnapshot: RuntimeStatusSnapshot = {
  state: "OFFLINE",
  cursor: 0,
  lastHeartbeatAt: null,
  recentEvents: [],
  blockedSystemsCount: 0,
  transport: "none",
  stream: "fallback",
};

export function useRuntimeStatus(pollMs = 2500): RuntimeStatusSnapshot {
  const [snapshot, setSnapshot] = useState<RuntimeStatusSnapshot>(initialSnapshot);

  useEffect(() => {
    let cancelled = false;
    let cursor = 0;
    let interval: number | null = null;
    let source: EventSource | null = null;

    function applyBatch(batch: Awaited<ReturnType<typeof readRuntimeEventsSince>>, stream: RuntimeStatusSnapshot["stream"]): void {
      cursor = batch.cursor;
      setSnapshot((previous) => {
        const events = [...batch.events, ...previous.recentEvents].slice(0, 6);
        return {
          state: transportStateFromBatch(batch),
          cursor: batch.cursor,
          lastHeartbeatAt: events.find((event) => event.type === "heartbeat")?.at ?? previous.lastHeartbeatAt,
          recentEvents: events,
          blockedSystemsCount: batch.blockedSystemsCount,
          transport: batch.transport,
          stream,
        };
      });
    }

    async function tick(): Promise<void> {
      try {
        const batch = await readRuntimeEventsSince(cursor);
        if (cancelled) {
          return;
        }
        applyBatch(batch, batch.transport === "browser-fallback" ? "fallback" : "polling");
      } catch {
        if (!cancelled) {
          setSnapshot((previous) => ({ ...previous, state: "BLOCKED", transport: "none", stream: "fallback" }));
        }
      }
    }

    function startPolling(): void {
      if (interval !== null) {
        return;
      }
      tick();
      interval = window.setInterval(tick, pollMs);
    }

    resolveRuntimeSseUrl()
      .then((url) => {
        if (cancelled) {
          return;
        }
        if (!url || typeof window.EventSource !== "function") {
          startPolling();
          return;
        }
        source = new EventSource(url);
        const onRuntimeStatus = (event: MessageEvent<string>) => {
          try {
            const batch = parseRuntimeSseData(event.data);
            if (!cancelled) {
              applyBatch(batch, "sse");
            }
          } catch {
            source?.close();
            source = null;
            startPolling();
          }
        };
        source.onmessage = onRuntimeStatus;
        source.addEventListener("runtime-status", onRuntimeStatus);
        source.onerror = () => {
          source?.close();
          source = null;
          startPolling();
        };
      })
      .catch(() => {
        if (!cancelled) {
          startPolling();
        }
      });

    return () => {
      cancelled = true;
      if (interval !== null) {
        window.clearInterval(interval);
      }
      source?.close();
    };
  }, [pollMs]);

  return snapshot;
}
