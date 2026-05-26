export type RuntimeTransportState = "LIVE" | "DEGRADED" | "OFFLINE" | "BLOCKED";

export type RuntimeEventType = "heartbeat" | "auth" | "evidence" | "runtime" | "blocked";

export type RuntimeEvent = {
  id: number;
  type: RuntimeEventType;
  at: number;
  title: string;
  detail: string;
  status: RuntimeTransportState;
};

export type RuntimeEventBatch = {
  ok: true;
  cursor: number;
  events: RuntimeEvent[];
  blockedSystemsCount: number;
  transport: "electron-ipc" | "browser-fallback";
};

export type RuntimeEventError = {
  ok: false;
  error: string;
  transport?: string;
};

export type RuntimeEventResult = RuntimeEventBatch | RuntimeEventError;

const fallbackStartedAt = Date.now();
let fallbackCursor = 0;

export function parseRuntimeEventBatch(input: unknown): RuntimeEventBatch {
  if (!input || typeof input !== "object" || (input as RuntimeEventResult).ok !== true) {
    throw new Error("RUNTIME_EVENT_BATCH_BLOCKED");
  }

  const batch = input as RuntimeEventBatch;
  if (!Number.isInteger(batch.cursor) || batch.cursor < 0) {
    throw new Error("RUNTIME_EVENT_CURSOR_INVALID");
  }
  if (!Array.isArray(batch.events)) {
    throw new Error("RUNTIME_EVENT_LIST_INVALID");
  }
  if (!Number.isInteger(batch.blockedSystemsCount) || batch.blockedSystemsCount < 0) {
    throw new Error("RUNTIME_BLOCKER_COUNT_INVALID");
  }
  if (batch.transport !== "electron-ipc" && batch.transport !== "browser-fallback") {
    throw new Error("RUNTIME_TRANSPORT_INVALID");
  }

  for (const event of batch.events) {
    validateRuntimeEvent(event);
  }

  return batch;
}

export async function readRuntimeEventsSince(cursor: number): Promise<RuntimeEventBatch> {
  const bridge = window.maataaDesktop as
    | (typeof window.maataaDesktop & {
        runtimeEventsSince?: (cursor: number) => Promise<RuntimeEventResult>;
      })
    | undefined;
  if (typeof bridge?.runtimeEventsSince === "function") {
    const result = await bridge.runtimeEventsSince(cursor);
    return parseRuntimeEventBatch(result);
  }

  return createFallbackBatch(cursor);
}

export function transportStateFromBatch(batch: RuntimeEventBatch): RuntimeTransportState {
  if (batch.events.some((event) => event.status === "BLOCKED")) {
    return "BLOCKED";
  }
  return batch.transport === "electron-ipc" ? "LIVE" : "DEGRADED";
}

function createFallbackBatch(cursor: number): RuntimeEventBatch {
  fallbackCursor = Math.max(fallbackCursor + 1, cursor + 1);
  return {
    ok: true,
    cursor: fallbackCursor,
    blockedSystemsCount: 6,
    transport: "browser-fallback",
    events: [
      {
        id: fallbackCursor,
        type: "heartbeat",
        at: Date.now(),
        title: "Browser fallback heartbeat",
        detail: `No Electron IPC stream detected; uptime ${Math.round((Date.now() - fallbackStartedAt) / 1000)}s.`,
        status: "DEGRADED",
      },
    ],
  };
}

function validateRuntimeEvent(event: RuntimeEvent): void {
  if (!Number.isInteger(event.id) || event.id <= 0) {
    throw new Error("RUNTIME_EVENT_ID_INVALID");
  }
  if (!["heartbeat", "auth", "evidence", "runtime", "blocked"].includes(event.type)) {
    throw new Error("RUNTIME_EVENT_TYPE_INVALID");
  }
  if (!Number.isFinite(event.at) || event.at <= 0) {
    throw new Error("RUNTIME_EVENT_TIME_INVALID");
  }
  if (!event.title || typeof event.title !== "string") {
    throw new Error("RUNTIME_EVENT_TITLE_INVALID");
  }
  if (!event.detail || typeof event.detail !== "string") {
    throw new Error("RUNTIME_EVENT_DETAIL_INVALID");
  }
  if (!["LIVE", "DEGRADED", "OFFLINE", "BLOCKED"].includes(event.status)) {
    throw new Error("RUNTIME_EVENT_STATUS_INVALID");
  }
}
