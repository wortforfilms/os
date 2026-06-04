export type RuntimeTransportState = "LIVE" | "DEGRADED" | "OFFLINE" | "BLOCKED";

export type RuntimeEventType = "heartbeat" | "auth" | "evidence" | "runtime" | "blocked";
export type RuntimeTransport = "sse" | "electron-ipc" | "browser-fallback";

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
  transport: RuntimeTransport;
};

export type RuntimeEventError = {
  ok: false;
  error: string;
  transport?: string;
};

export type RuntimeEventResult = RuntimeEventBatch | RuntimeEventError;

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
  if (!isRuntimeTransport(batch.transport)) {
    throw new Error("RUNTIME_TRANSPORT_INVALID");
  }

  for (const event of batch.events) {
    validateRuntimeEvent(event);
  }

  return batch;
}

export function parseRuntimeSseData(data: string): RuntimeEventBatch {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    throw new Error("RUNTIME_SSE_DATA_INVALID");
  }
  const batch = parseRuntimeEventBatch(parsed);
  if (batch.transport !== "sse") {
    throw new Error("RUNTIME_SSE_TRANSPORT_INVALID");
  }
  return batch;
}

export async function resolveRuntimeSseUrl(): Promise<string | null> {
  const info = await window.maataaDesktop?.runtimeInfo?.();
  if (!info || typeof info !== "object") {
    return null;
  }
  const target = (info as { telemetryTarget?: unknown }).telemetryTarget;
  if (typeof target !== "string" || target.trim() === "") {
    return null;
  }
  return isAllowedLocalSseUrl(target) ? target : null;
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

  return createBrowserFallbackBatch(cursor);
}

export function transportStateFromBatch(batch: RuntimeEventBatch): RuntimeTransportState {
  if (batch.events.some((event) => event.status === "BLOCKED")) {
    return "BLOCKED";
  }
  if (batch.events.some((event) => event.status === "OFFLINE")) {
    return "OFFLINE";
  }
  if (batch.events.some((event) => event.status === "DEGRADED")) {
    return "DEGRADED";
  }
  return batch.transport === "browser-fallback" ? "DEGRADED" : "LIVE";
}

export function createBrowserFallbackBatch(cursor: number): RuntimeEventBatch {
  fallbackCursor = Math.max(fallbackCursor + 1, cursor + 1);
  return {
    ok: true,
    cursor: fallbackCursor,
    blockedSystemsCount: 6,
    transport: "browser-fallback",
    events: [
      {
        id: fallbackCursor,
        type: "runtime",
        at: Date.now(),
        title: "Runtime stream unavailable",
        detail: "No local SSE or Electron IPC stream is connected; browser is showing a degraded fallback only.",
        status: "DEGRADED",
      },
    ],
  };
}

function isRuntimeTransport(transport: unknown): transport is RuntimeTransport {
  return transport === "sse" || transport === "electron-ipc" || transport === "browser-fallback";
}

function isAllowedLocalSseUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return (url.protocol === "http:" || url.protocol === "https:") && ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
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
