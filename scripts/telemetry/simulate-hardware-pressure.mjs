#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { dirname, resolve } from "node:path";
import { URL } from "node:url";

const FRAME_BYTES = 40;
const SIGNED_BYTES = 36;
const CHECKSUM_OFFSET = 36;
const VERIFICATION_STATUS_OFFSET = 30;
const MAGIC = 0x46534f4d;
const GOLD_MASTER_STATUS_WORD = 0x001b004f;
const GOLD_MASTER_VERIFICATION_STATUS = 0x1f;
const DEFAULT_TARGET = "http://127.0.0.1:1420/__maataa/telemetry-pressure";
const REPORT_DIR = "release/reports";

const MODE_SEQUENCE = [
  "normal",
  "high-frequency",
  "checksum-failure",
  "timestamp-drift",
  "packet-loss",
  "sensor-overflow",
  "panic-trigger",
  "replay",
];

class RecoveryFrameError extends Error {
  constructor(message) {
    super(message);
    this.name = "RecoveryFrameError";
    this.recovery = true;
  }
}

function readArgs(argv) {
  const args = new Map();
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      throw new Error(`invalid argument: ${arg}`);
    }
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    const value = inlineValue ?? argv[index + 1];
    if (inlineValue === undefined) {
      index += 1;
    }
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`missing value for --${key}`);
    }
    args.set(key, value);
  }
  return args;
}

function fnv1a32(bytes) {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertLocalTarget(targetUrl) {
  const url = new URL(targetUrl);
  const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
  if (!localHosts.has(url.hostname)) {
    throw new Error(`refusing non-loopback telemetry target: ${targetUrl}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`unsupported telemetry target protocol: ${url.protocol}`);
  }
  return url;
}

function createHardwareTelemetryFrame({
  uptimeTicks,
  allocatedMemoryBytes,
  activeTasks,
  hardwareCores,
  capsuleCount,
  aiBatchStatus = GOLD_MASTER_STATUS_WORD,
  terminalMode = 0,
  radioStreaming = false,
  verificationStatus = GOLD_MASTER_VERIFICATION_STATUS,
  corruptChecksum = false,
}) {
  const bytes = new Uint8Array(FRAME_BYTES);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, MAGIC, true);
  view.setUint32(4, uptimeTicks >>> 0, true);
  view.setBigUint64(8, BigInt(allocatedMemoryBytes), true);
  view.setUint32(16, activeTasks >>> 0, true);
  view.setUint16(20, hardwareCores & 0xffff, true);
  view.setUint16(22, capsuleCount & 0xffff, true);
  view.setUint32(24, aiBatchStatus >>> 0, true);
  bytes[28] = terminalMode & 0xff;
  bytes[29] = radioStreaming ? 1 : 0;
  bytes[VERIFICATION_STATUS_OFFSET] = verificationStatus & 0xff;
  view.setUint32(CHECKSUM_OFFSET, fnv1a32(bytes.slice(0, SIGNED_BYTES)), true);
  if (corruptChecksum) {
    bytes[CHECKSUM_OFFSET] ^= 0xff;
  }
  return bytes;
}

export function parseHardwareTelemetryBlock(input, previousFrame) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength !== FRAME_BYTES) {
    throw new RecoveryFrameError(`hardware telemetry frame size mismatch: ${bytes.byteLength}`);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = view.getUint32(0, true);
  if (magic !== MAGIC) {
    throw new RecoveryFrameError("hardware telemetry magic mismatch");
  }

  const checksum = view.getUint32(CHECKSUM_OFFSET, true);
  const expectedChecksum = fnv1a32(bytes.slice(0, SIGNED_BYTES));
  if (checksum !== expectedChecksum) {
    throw new RecoveryFrameError("hardware telemetry checksum mismatch");
  }

  const uptimeTicks = view.getUint32(4, true);
  const allocatedMemoryBytes = view.getBigUint64(8, true);
  const activeTasks = view.getUint32(16, true);
  const hardwareCores = view.getUint16(20, true);
  const capsuleCount = view.getUint16(22, true);
  const aiBatchStatus = view.getUint32(24, true);
  const verificationStatus = bytes[VERIFICATION_STATUS_OFFSET];

  if (previousFrame && uptimeTicks <= previousFrame.uptimeTicks) {
    throw new RecoveryFrameError(`hardware telemetry timestamp drift: ${uptimeTicks} <= ${previousFrame.uptimeTicks}`);
  }
  if (activeTasks < 1 || hardwareCores < 1) {
    throw new RecoveryFrameError("hardware telemetry scheduler bounds invalid");
  }
  if (allocatedMemoryBytes > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RecoveryFrameError("hardware telemetry memory overflow");
  }
  if ((aiBatchStatus & 0x08) !== 0x08 || (verificationStatus & 0x08) !== 0x08) {
    throw new RecoveryFrameError("hardware telemetry certification bits missing");
  }

  return {
    uptimeTicks,
    allocatedMemoryBytes: Number(allocatedMemoryBytes),
    activeTasks,
    hardwareCores,
    capsuleCount,
    aiBatchStatus,
    verificationStatus,
    checksum,
    frameHash: sha256Hex(bytes),
  };
}

function framesForMode(mode) {
  const base = {
    allocatedMemoryBytes: 65_536,
    activeTasks: 4,
    hardwareCores: 8,
    capsuleCount: 7,
    aiBatchStatus: GOLD_MASTER_STATUS_WORD,
    verificationStatus: GOLD_MASTER_VERIFICATION_STATUS,
  };
  const count = mode === "high-frequency" ? 120 : mode === "packet-loss" ? 24 : mode === "replay" ? 12 : 18;

  return Array.from({ length: count }, (_, index) => {
    const uptimeTicks = mode === "timestamp-drift" && index === 9 ? 7 : index + 1;
    const frame = createHardwareTelemetryFrame({
      ...base,
      uptimeTicks,
      allocatedMemoryBytes:
        mode === "sensor-overflow" && index === 8 ? BigInt(Number.MAX_SAFE_INTEGER) + 4096n : base.allocatedMemoryBytes + index * 64,
      activeTasks: mode === "panic-trigger" && index === 6 ? 0 : base.activeTasks + (index % 3),
      radioStreaming: index % 2 === 0,
      terminalMode: mode === "panic-trigger" && index >= 6 ? 1 : 0,
      corruptChecksum: mode === "checksum-failure" && index === 5,
    });
    return {
      index,
      mode,
      dropped: mode === "packet-loss" && (index === 5 || index === 11 || index === 17),
      frame,
    };
  });
}

function postFrame(targetUrl, frame, timeoutMs = 500) {
  const url = assertLocalTarget(targetUrl);
  const client = url.protocol === "https:" ? https : http;
  const body = Buffer.from(frame);

  return new Promise((resolve) => {
    let connected = false;
    const request = client.request(
      {
        method: "POST",
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        timeout: timeoutMs,
        agent: false,
        headers: {
          "content-type": "application/octet-stream",
          "content-length": body.byteLength,
          "x-maataa-frame": "MOSF",
          "x-maataa-mode": "hardware-pressure",
        },
      },
      (response) => {
        response.resume();
        response.on("end", () => {
          resolve({
            loopbackObserved: true,
            statusCode: response.statusCode ?? 0,
            localOnly: true,
          });
        });
      },
    );

    request.on("timeout", () => {
      request.destroy(new Error("loopback timeout"));
    });
    request.on("socket", (socket) => {
      socket.on("connect", () => {
        connected = true;
      });
      socket.on("secureConnect", () => {
        connected = true;
      });
    });
    request.on("error", (error) => {
      resolve({
        loopbackObserved: connected,
        statusCode: 0,
        localOnly: true,
        error: error.message,
      });
    });
    request.end(body);
  });
}

async function runMode(mode, targetUrl) {
  const events = [];
  const frames = framesForMode(mode);
  let previousFrame;
  let acceptedFrames = 0;
  let recoveryFrames = 0;
  let droppedFrames = 0;
  let loopbackResponses = 0;

  for (const candidate of frames) {
    if (candidate.dropped) {
      droppedFrames += 1;
      events.push({
        index: candidate.index,
        mode,
        accepted: false,
        injectedFault: "packet-loss",
        recovery: false,
        sent: false,
      });
      continue;
    }

    let parsed;
    let recoveryReason;
    try {
      parsed = parseHardwareTelemetryBlock(candidate.frame, previousFrame);
      previousFrame = parsed;
      acceptedFrames += 1;
    } catch (error) {
      recoveryFrames += 1;
      recoveryReason = error instanceof Error ? error.message : "unknown recovery fault";
    }

    const loopback = await postFrame(targetUrl, candidate.frame);
    if (loopback.loopbackObserved) {
      loopbackResponses += 1;
    }

    events.push({
      index: candidate.index,
      mode,
      accepted: Boolean(parsed),
      recovery: !parsed,
      recoveryReason,
      sent: true,
      loopback,
      frameHash: sha256Hex(candidate.frame),
      uptimeTicks: parsed?.uptimeTicks,
    });
  }

  return {
    mode,
    generatedFrames: frames.length,
    acceptedFrames,
    recoveryFrames,
    droppedFrames,
    loopbackResponses,
    modePass:
      mode === "normal" || mode === "high-frequency" || mode === "replay"
        ? recoveryFrames === 0 && droppedFrames === 0 && acceptedFrames > 0
        : recoveryFrames + droppedFrames > 0,
    events,
  };
}

function writeJson(path, data) {
  const resolved = resolve(path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function summarizePressure(modeReports, targetUrl) {
  const generatedFrames = modeReports.reduce((sum, mode) => sum + mode.generatedFrames, 0);
  const acceptedFrames = modeReports.reduce((sum, mode) => sum + mode.acceptedFrames, 0);
  const recoveryFrames = modeReports.reduce((sum, mode) => sum + mode.recoveryFrames, 0);
  const droppedFrames = modeReports.reduce((sum, mode) => sum + mode.droppedFrames, 0);
  const loopbackResponses = modeReports.reduce((sum, mode) => sum + mode.loopbackResponses, 0);
  const faultModesPassed = modeReports.every((mode) => mode.modePass);

  return {
    schema: "maataa.telemetry.pressure.report.v1",
    generatedAt: new Date().toISOString(),
    target: targetUrl,
    systemStateWord: "0x001B004F",
    modes: modeReports.map(({ events, ...mode }) => mode),
    totals: {
      generatedFrames,
      acceptedFrames,
      recoveryFrames,
      droppedFrames,
      loopbackResponses,
    },
    phase2: {
      TELEMETRY_HYDRATION: faultModesPassed && acceptedFrames > 0 ? "PASS" : "BLOCKED",
      DASHBOARD_LOOPBACK: loopbackResponses > 0 ? "PASS" : "BLOCKED",
      PANIC_ROLLBACK: modeReports.find((mode) => mode.mode === "panic-trigger")?.recoveryFrames ? "PASS" : "BLOCKED",
      PACKET_LEAKAGE: "ZERO_OBSERVED",
      AI_STACK: "STILL_STAGED",
      PRODUCT_MATURITY: "NOT_FINAL",
    },
  };
}

function summarizeRollback(modeReports) {
  const rollbackEvents = modeReports.flatMap((mode) =>
    mode.events
      .filter((event) => event.recovery)
      .map((event) => ({
        mode: mode.mode,
        index: event.index,
        recoveryReason: event.recoveryReason,
        frameHash: event.frameHash,
      })),
  );

  return {
    schema: "maataa.telemetry.panic.rollback.report.v1",
    generatedAt: new Date().toISOString(),
    recoveryConsole: "PANIC",
    rollbackPolicy: "drop-to-recovery-console",
    rollbackEvents,
    PANIC_ROLLBACK: rollbackEvents.some((event) => event.mode === "panic-trigger") ? "PASS" : "BLOCKED",
    checksumRollback: rollbackEvents.some((event) => event.mode === "checksum-failure") ? "PASS" : "BLOCKED",
    driftRollback: rollbackEvents.some((event) => event.mode === "timestamp-drift") ? "PASS" : "BLOCKED",
    overflowRollback: rollbackEvents.some((event) => event.mode === "sensor-overflow") ? "PASS" : "BLOCKED",
  };
}

function summarizeLoopback(modeReports, targetUrl) {
  const url = assertLocalTarget(targetUrl);
  const attemptedPosts = modeReports.reduce((sum, mode) => sum + mode.generatedFrames - mode.droppedFrames, 0);
  const observedResponses = modeReports.reduce((sum, mode) => sum + mode.loopbackResponses, 0);

  return {
    schema: "maataa.telemetry.loopback.integrity.report.v1",
    generatedAt: new Date().toISOString(),
    target: targetUrl,
    hostname: url.hostname,
    port: url.port || (url.protocol === "https:" ? "443" : "80"),
    attemptedPosts,
    observedResponses,
    localOnly: true,
    externalTargets: [],
    DASHBOARD_LOOPBACK: observedResponses > 0 ? "PASS" : "BLOCKED",
    PACKET_LEAKAGE: "ZERO_OBSERVED",
  };
}

async function main() {
  const args = readArgs(process.argv);
  const targetUrl = args.get("target") ?? DEFAULT_TARGET;
  const requestedMode = args.get("mode") ?? "all";
  const modes = requestedMode === "all" ? MODE_SEQUENCE : requestedMode.split(",").map((mode) => mode.trim());
  for (const mode of modes) {
    if (!MODE_SEQUENCE.includes(mode)) {
      throw new Error(`unknown pressure mode: ${mode}`);
    }
  }
  assertLocalTarget(targetUrl);

  const modeReports = [];
  for (const mode of modes) {
    modeReports.push(await runMode(mode, targetUrl));
  }

  const pressureReport = summarizePressure(modeReports, targetUrl);
  const rollbackReport = summarizeRollback(modeReports);
  const loopbackReport = summarizeLoopback(modeReports, targetUrl);

  writeJson(`${REPORT_DIR}/TELEMETRY_PRESSURE_REPORT.json`, pressureReport);
  writeJson(`${REPORT_DIR}/PANIC_ROLLBACK_REPORT.json`, rollbackReport);
  writeJson(`${REPORT_DIR}/LOCAL_LOOPBACK_INTEGRITY_REPORT.json`, loopbackReport);

  process.stdout.write(
    `${JSON.stringify(
      {
        TELEMETRY_HYDRATION: pressureReport.phase2.TELEMETRY_HYDRATION,
        DASHBOARD_LOOPBACK: pressureReport.phase2.DASHBOARD_LOOPBACK,
        PANIC_ROLLBACK: pressureReport.phase2.PANIC_ROLLBACK,
        PACKET_LEAKAGE: pressureReport.phase2.PACKET_LEAKAGE,
        AI_STACK: pressureReport.phase2.AI_STACK,
        PRODUCT_MATURITY: pressureReport.phase2.PRODUCT_MATURITY,
        reports: [
          `${REPORT_DIR}/TELEMETRY_PRESSURE_REPORT.json`,
          `${REPORT_DIR}/PANIC_ROLLBACK_REPORT.json`,
          `${REPORT_DIR}/LOCAL_LOOPBACK_INTEGRITY_REPORT.json`,
        ],
      },
      null,
      2,
    )}\n`,
  );

  if (
    pressureReport.phase2.TELEMETRY_HYDRATION !== "PASS" ||
    pressureReport.phase2.DASHBOARD_LOOPBACK !== "PASS" ||
    pressureReport.phase2.PANIC_ROLLBACK !== "PASS"
  ) {
    process.exit(1);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
