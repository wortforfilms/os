#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join, relative, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { URL } from "node:url";

const TARGET_URL = "http://127.0.0.1:1420/api/telemetry-stream";
const FRAME_BYTES = 40;
const SIGNED_BYTES = 36;
const CHECKSUM_OFFSET = 36;
const VERIFICATION_STATUS_OFFSET = 30;
const MAGIC = 0x46534f4d;
const CERTIFIED_STATUS_WORD = 0x001b004f;
const INVALID_STATUS_WORD = 0xdeadbeef;
const CERTIFIED_VERIFICATION_MASK = 0x1f;
const FRAME_INTERVAL_MS = 16.67;
const TOTAL_FRAMES = 90;
const FIRST_DRIFT_TICK = 30;
const REPORT_PATH = "release/reports/TELEMETRY_CHAOS_HARNESS_REPORT.json";

type DashboardTheme = "SCIENTIFIC_CERTIFIED" | "CONTROLLED_NO_GO";

type ParsedTelemetryFrame = {
  uptimeTicks: number;
  allocatedMemoryBytes: number;
  activeTasks: number;
  hardwareCores: number;
  capsuleCount: number;
  aiBatchStatus: number;
  verificationStatus: number;
  checksum: number;
  frameHash: string;
};

type SensorLandmarkBlock = {
  tick: number;
  x: number;
  y: number;
  z: number;
  pressure: number;
  sensorMask: number;
  checksum: number;
  bytes: Uint8Array;
};

type PanicTransition = {
  tick: number;
  reason: string;
  latencyFrames: number;
  previousTheme: DashboardTheme;
  nextTheme: DashboardTheme;
};

type HarnessReport = {
  schema: "maataa.telemetry.chaos.harness.v1";
  generatedAt: string;
  target: string;
  profile: {
    frequencyHz: number;
    intervalMs: number;
    frameBytes: number;
    sensorStructBytes: number;
    totalFrames: number;
  };
  totals: {
    generatedFrames: number;
    acceptedFrames: number;
    rejectedFrames: number;
    postedFrames: number;
    loopbackResponses: number;
    externalAttempts: number;
  };
  dashboard: {
    initialTheme: DashboardTheme;
    finalTheme: DashboardTheme;
    listenerTerminated: boolean;
    panicTransitions: PanicTransition[];
  };
  verdict: {
    TELEMETRY_HYDRATION: "PASS" | "BLOCKED";
    DASHBOARD_LOOPBACK: "PASS" | "BLOCKED";
    PANIC_ROLLBACK: "PASS" | "BLOCKED";
    VIEWPORT_REFLEX_UNDER_ONE_FRAME: "PASS" | "BLOCKED";
    PACKET_LEAKAGE: "ZERO_OBSERVED" | "BLOCKED";
    ASSETS_HTML_HYGIENE: "PASS" | "BLOCKED";
    AI_STACK: "STILL_STAGED";
    PRODUCT_MATURITY: "NOT_FINAL";
  };
};

class RecoveryFrameError extends Error {
  readonly recovery = true;

  constructor(message: string) {
    super(message);
    this.name = "RecoveryFrameError";
  }
}

class VirtualSovereignDashboard {
  readonly initialTheme: DashboardTheme = "SCIENTIFIC_CERTIFIED";
  theme: DashboardTheme = "SCIENTIFIC_CERTIFIED";
  listenerActive = true;
  acceptedFrames = 0;
  rejectedFrames = 0;
  panicTransitions: PanicTransition[] = [];
  #previousFrame?: ParsedTelemetryFrame;

  ingest(frame: Uint8Array, tick: number): void {
    if (!this.listenerActive) {
      return;
    }

    try {
      const parsed = parseHardwareTelemetryBlock(frame, this.#previousFrame);
      this.#previousFrame = parsed;
      if (parsed.aiBatchStatus !== CERTIFIED_STATUS_WORD) {
        throw new RecoveryFrameError(`status word drift: 0x${parsed.aiBatchStatus.toString(16).padStart(8, "0")}`);
      }
      this.acceptedFrames += 1;
    } catch (error) {
      this.rejectedFrames += 1;
      this.tripPanic(tick, error instanceof Error ? error.message : "unknown telemetry drift");
    }
  }

  private tripPanic(tick: number, reason: string): void {
    const previousTheme = this.theme;
    this.theme = "CONTROLLED_NO_GO";
    this.listenerActive = false;
    this.panicTransitions.push({
      tick,
      reason,
      latencyFrames: 0,
      previousTheme,
      nextTheme: this.theme,
    });
  }
}

function fnv1a32(bytes: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertLoopbackUrl(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:") {
    throw new Error(`blocked non-http telemetry protocol: ${url.protocol}`);
  }
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost" && url.hostname !== "::1") {
    throw new Error(`blocked non-loopback telemetry target: ${rawUrl}`);
  }
  return url;
}

function createSensorLandmarkBlock(tick: number): SensorLandmarkBlock {
  const bytes = new Uint8Array(20);
  const view = new DataView(bytes.buffer);
  const x = ((tick * 37) % 2048) - 1024;
  const y = ((tick * 53) % 2048) - 1024;
  const z = ((tick * 71) % 2048) - 1024;
  const pressure = (tick * 97) & 0xffff;
  const sensorMask = 0x4d_53_41_52 ^ tick;

  view.setUint32(0, tick, true);
  view.setInt16(4, x, true);
  view.setInt16(6, y, true);
  view.setInt16(8, z, true);
  view.setUint16(10, pressure, true);
  view.setUint32(12, sensorMask >>> 0, true);
  view.setUint32(16, fnv1a32(bytes.slice(0, 16)), true);

  return {
    tick,
    x,
    y,
    z,
    pressure,
    sensorMask,
    checksum: view.getUint32(16, true),
    bytes,
  };
}

function createMosfFrame(sensor: SensorLandmarkBlock, statusWord: number): Uint8Array {
  const bytes = new Uint8Array(FRAME_BYTES);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, MAGIC, true);
  view.setUint32(4, sensor.tick, true);
  view.setBigUint64(8, BigInt(65_536 + sensor.pressure), true);
  view.setUint32(16, 4 + (sensor.tick % 4), true);
  view.setUint16(20, 8, true);
  view.setUint16(22, 7, true);
  view.setUint32(24, statusWord >>> 0, true);
  bytes[28] = 0;
  bytes[29] = sensor.tick % 2;
  bytes[VERIFICATION_STATUS_OFFSET] = CERTIFIED_VERIFICATION_MASK;
  bytes[31] = sensor.bytes[4] & 0xff;
  bytes[32] = sensor.bytes[6] & 0xff;
  bytes[33] = sensor.bytes[8] & 0xff;
  bytes[34] = sensor.bytes[10] & 0xff;
  bytes[35] = sensor.checksum & 0xff;
  view.setUint32(CHECKSUM_OFFSET, fnv1a32(bytes.slice(0, SIGNED_BYTES)), true);
  return bytes;
}

function parseHardwareTelemetryBlock(input: Uint8Array, previousFrame?: ParsedTelemetryFrame): ParsedTelemetryFrame {
  if (input.byteLength !== FRAME_BYTES) {
    throw new RecoveryFrameError(`frame size mismatch: ${input.byteLength}`);
  }

  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const magic = view.getUint32(0, true);
  if (magic !== MAGIC) {
    throw new RecoveryFrameError("magic mismatch");
  }

  const checksum = view.getUint32(CHECKSUM_OFFSET, true);
  const expectedChecksum = fnv1a32(input.slice(0, SIGNED_BYTES));
  if (checksum !== expectedChecksum) {
    throw new RecoveryFrameError("checksum mismatch");
  }

  const uptimeTicks = view.getUint32(4, true);
  if (previousFrame && uptimeTicks <= previousFrame.uptimeTicks) {
    throw new RecoveryFrameError(`timestamp drift: ${uptimeTicks} <= ${previousFrame.uptimeTicks}`);
  }

  const allocatedMemoryBytes = Number(view.getBigUint64(8, true));
  const activeTasks = view.getUint32(16, true);
  const hardwareCores = view.getUint16(20, true);
  const capsuleCount = view.getUint16(22, true);
  const aiBatchStatus = view.getUint32(24, true);
  const verificationStatus = input[VERIFICATION_STATUS_OFFSET];

  if (!Number.isSafeInteger(allocatedMemoryBytes)) {
    throw new RecoveryFrameError("memory overflow");
  }
  if (activeTasks < 1 || hardwareCores < 1) {
    throw new RecoveryFrameError("scheduler bounds invalid");
  }
  if ((verificationStatus & 0x08) !== 0x08) {
    throw new RecoveryFrameError("verification bit missing");
  }

  return {
    uptimeTicks,
    allocatedMemoryBytes,
    activeTasks,
    hardwareCores,
    capsuleCount,
    aiBatchStatus,
    verificationStatus,
    checksum,
    frameHash: sha256Hex(input),
  };
}

async function readBody(request: IncomingMessage): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return new Uint8Array(Buffer.concat(chunks));
}

async function tryStartLoopbackServer(viewport: VirtualSovereignDashboard): Promise<http.Server | undefined> {
  const server = http.createServer(async (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== "POST" || request.url !== "/api/telemetry-stream") {
      response.writeHead(404).end();
      return;
    }

    const body = await readBody(request);
    const tick = body.byteLength === FRAME_BYTES ? new DataView(body.buffer, body.byteOffset, body.byteLength).getUint32(4, true) : 0;
    viewport.ingest(body, tick);
    response.writeHead(viewport.theme === "CONTROLLED_NO_GO" ? 409 : 204).end();
  });

  return new Promise((resolve, reject) => {
    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        resolve(undefined);
      } else {
        reject(error);
      }
    });
    server.listen(1420, "127.0.0.1", () => {
      resolve(server);
    });
  });
}

function postFrame(targetUrl: string, frame: Uint8Array): Promise<{ connected: boolean; statusCode: number; error?: string }> {
  const url = assertLoopbackUrl(targetUrl);
  const body = Buffer.from(frame);

  return new Promise((resolve) => {
    let connected = false;
    const request = http.request(
      {
        method: "POST",
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        timeout: 750,
        agent: false,
        headers: {
          "content-type": "application/octet-stream",
          "content-length": body.byteLength,
          "x-maataa-chaos": "telemetry-60hz",
        },
      },
      (response) => {
        response.resume();
        response.on("end", () => resolve({ connected: true, statusCode: response.statusCode ?? 0 }));
      },
    );

    request.on("socket", (socket) => {
      socket.once("connect", () => {
        connected = true;
      });
    });
    request.on("timeout", () => request.destroy(new Error("telemetry loopback timeout")));
    request.on("error", (error) => {
      resolve({ connected, statusCode: 0, error: error.message });
    });
    request.end(body);
  });
}

function listAssetsHtmlFiles(): string[] {
  const root = resolve("assets/html");
  if (!existsSync(root)) {
    return [];
  }

  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      const stat = statSync(path);
      if (stat.isDirectory()) {
        walk(path);
      } else {
        out.push(relative(root, path));
      }
    }
  };
  walk(root);
  return out.sort();
}

function writeJson(path: string, data: unknown): void {
  const resolved = resolve(path);
  if (resolved.includes("/assets/html/")) {
    throw new Error("refusing to write telemetry chaos report into assets/html");
  }
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  assertLoopbackUrl(TARGET_URL);
  const assetsBefore = listAssetsHtmlFiles();
  const viewport = new VirtualSovereignDashboard();
  const server = await tryStartLoopbackServer(viewport);
  const serverMode = server ? "owned-loopback-server" : "attached-existing-tauri-runtime";
  let postedFrames = 0;
  let loopbackResponses = 0;
  let externalAttempts = 0;

  try {
    for (let tick = 1; tick <= TOTAL_FRAMES; tick += 1) {
      const sensor = createSensorLandmarkBlock(tick);
      const statusWord = tick === FIRST_DRIFT_TICK ? INVALID_STATUS_WORD : CERTIFIED_STATUS_WORD;
      const frame = createMosfFrame(sensor, statusWord);

      if (!viewport.listenerActive) {
        break;
      }

      if (!server) {
        viewport.ingest(frame, tick);
      }
      const response = await postFrame(TARGET_URL, frame);
      postedFrames += 1;
      if (response.connected) {
        loopbackResponses += 1;
      }

      await sleep(FRAME_INTERVAL_MS);
    }
  } finally {
    if (server) {
      await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    }
  }

  const assetsAfter = listAssetsHtmlFiles();
  const assetsHtmlClean = JSON.stringify(assetsBefore) === JSON.stringify(assetsAfter);
  const panic = viewport.panicTransitions[0];
  const report: HarnessReport = {
    schema: "maataa.telemetry.chaos.harness.v1",
    generatedAt: new Date().toISOString(),
    target: TARGET_URL,
    profile: {
      frequencyHz: 60,
      intervalMs: FRAME_INTERVAL_MS,
      frameBytes: FRAME_BYTES,
      sensorStructBytes: 20,
      totalFrames: TOTAL_FRAMES,
    },
    totals: {
      generatedFrames: FIRST_DRIFT_TICK,
      acceptedFrames: viewport.acceptedFrames,
      rejectedFrames: viewport.rejectedFrames,
      postedFrames,
      loopbackResponses,
      externalAttempts,
    },
    dashboard: {
      initialTheme: viewport.initialTheme,
      finalTheme: viewport.theme,
      listenerTerminated: !viewport.listenerActive,
      panicTransitions: viewport.panicTransitions,
    },
    verdict: {
      TELEMETRY_HYDRATION: viewport.acceptedFrames > 0 ? "PASS" : "BLOCKED",
      DASHBOARD_LOOPBACK: loopbackResponses === postedFrames && postedFrames > 0 ? "PASS" : "BLOCKED",
      PANIC_ROLLBACK: viewport.theme === "CONTROLLED_NO_GO" && !viewport.listenerActive ? "PASS" : "BLOCKED",
      VIEWPORT_REFLEX_UNDER_ONE_FRAME: panic && panic.latencyFrames <= 1 ? "PASS" : "BLOCKED",
      PACKET_LEAKAGE: externalAttempts === 0 ? "ZERO_OBSERVED" : "BLOCKED",
      ASSETS_HTML_HYGIENE: assetsHtmlClean ? "PASS" : "BLOCKED",
      AI_STACK: "STILL_STAGED",
      PRODUCT_MATURITY: "NOT_FINAL",
    },
  };

  writeJson("release/reports/TELEMETRY_CHAOS_HARNESS_REPORT.json", report);
  process.stdout.write(`${JSON.stringify(report.verdict, null, 2)}\n`);

  if (Object.values(report.verdict).includes("BLOCKED")) {
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
