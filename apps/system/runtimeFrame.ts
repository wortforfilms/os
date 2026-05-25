import type { ModuleStatus } from "./modules";

export const NATIVE_METRIC_FRAME_BYTES = 40;
export const NATIVE_METRIC_FRAME_MAGIC = 0x4d4f5346;
export const NATIVE_METRIC_FRAME_VERSION = 1;

const SIGNATURE_OFFSET = 12;

export type QemuEngineCode = 1;

export type NativeMetricFrame = {
  magic: typeof NATIVE_METRIC_FRAME_MAGIC;
  version: typeof NATIVE_METRIC_FRAME_VERSION;
  kind: 1;
  byteLength: typeof NATIVE_METRIC_FRAME_BYTES;
  flags: number;
  sequence: number;
  signature: number;
  hostThreads: number;
  qemuEngine: QemuEngineCode;
  health: ModuleStatus;
  scriptKnown: number;
  scriptUnknown: number;
  scriptWeight: number;
  ipcFrames: number;
  capsuleBytes: number;
  schedulerTicks: number;
};

export class RecoveryFrameError extends Error {
  readonly recovery = true;

  constructor(message: string) {
    super(message);
    this.name = "RecoveryFrameError";
  }
}

function fnv1a32(bytes: Uint8Array): number {
  let hash = 0x811c9dc5;

  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

function signatureBytes(frame: Uint8Array): Uint8Array {
  const copy = frame.slice(0, NATIVE_METRIC_FRAME_BYTES);
  copy[SIGNATURE_OFFSET] = 0;
  copy[SIGNATURE_OFFSET + 1] = 0;
  copy[SIGNATURE_OFFSET + 2] = 0;
  copy[SIGNATURE_OFFSET + 3] = 0;
  return copy;
}

function assertU16(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new RecoveryFrameError(`native metric frame invalid ${name}`);
  }
}

function statusFromCode(code: number): ModuleStatus {
  switch (code) {
    case 0:
      return "nominal";
    case 1:
      return "warning";
    case 2:
      return "critical";
    case 3:
      return "offline";
    default:
      throw new RecoveryFrameError("native metric frame invalid health code");
  }
}

function statusToCode(status: ModuleStatus): number {
  switch (status) {
    case "nominal":
      return 0;
    case "warning":
      return 1;
    case "critical":
      return 2;
    case "offline":
      return 3;
  }
}

export function parseNativeMetricFrame(input: Uint8Array | ArrayBufferLike): NativeMetricFrame {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength !== NATIVE_METRIC_FRAME_BYTES) {
    throw new RecoveryFrameError(`native metric frame size mismatch: ${bytes.byteLength}`);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = view.getUint32(0, true);
  const version = view.getUint16(4, true);
  const kind = view.getUint16(6, true);
  const byteLength = view.getUint16(8, true);
  const flags = view.getUint16(10, true);
  const signature = view.getUint32(SIGNATURE_OFFSET, true);
  const expectedSignature = fnv1a32(signatureBytes(bytes));

  if (magic !== NATIVE_METRIC_FRAME_MAGIC) {
    throw new RecoveryFrameError("native metric frame magic mismatch");
  }

  if (version !== NATIVE_METRIC_FRAME_VERSION || kind !== 1 || byteLength !== NATIVE_METRIC_FRAME_BYTES) {
    throw new RecoveryFrameError("native metric frame schema mismatch");
  }

  if (signature !== expectedSignature) {
    throw new RecoveryFrameError("native metric frame signature mismatch");
  }

  const hostThreads = view.getUint16(20, true);
  const qemuEngine = view.getUint16(22, true);
  const health = statusFromCode(view.getUint8(24));
  const scriptKnown = view.getUint16(26, true);
  const scriptUnknown = view.getUint16(28, true);
  const scriptWeight = view.getUint16(30, true);
  const ipcFrames = view.getUint16(32, true);
  const capsuleBytes = view.getUint32(34, true);
  const schedulerTicks = view.getUint16(38, true);

  if (hostThreads < 1 || qemuEngine !== 1 || schedulerTicks < 1) {
    throw new RecoveryFrameError("native metric frame invalid runtime values");
  }

  return {
    magic,
    version,
    kind: 1,
    byteLength,
    flags,
    sequence: view.getUint32(16, true),
    signature,
    hostThreads,
    qemuEngine,
    health,
    scriptKnown,
    scriptUnknown,
    scriptWeight,
    ipcFrames,
    capsuleBytes,
    schedulerTicks,
  };
}

export function createNativeMetricFrame(input: {
  hostThreads: number;
  health: ModuleStatus;
  scriptKnown: number;
  scriptUnknown: number;
  scriptWeight: number;
  ipcFrames: number;
  capsuleBytes: number;
  schedulerTicks: number;
  sequence?: number;
}): Uint8Array {
  assertU16("hostThreads", input.hostThreads);
  assertU16("scriptKnown", input.scriptKnown);
  assertU16("scriptUnknown", input.scriptUnknown);
  assertU16("scriptWeight", input.scriptWeight);
  assertU16("ipcFrames", input.ipcFrames);
  assertU16("schedulerTicks", input.schedulerTicks);

  const bytes = new Uint8Array(NATIVE_METRIC_FRAME_BYTES);
  const view = new DataView(bytes.buffer);

  view.setUint32(0, NATIVE_METRIC_FRAME_MAGIC, true);
  view.setUint16(4, NATIVE_METRIC_FRAME_VERSION, true);
  view.setUint16(6, 1, true);
  view.setUint16(8, NATIVE_METRIC_FRAME_BYTES, true);
  view.setUint16(10, 0, true);
  view.setUint32(16, input.sequence ?? 1, true);
  view.setUint16(20, input.hostThreads, true);
  view.setUint16(22, 1, true);
  view.setUint8(24, statusToCode(input.health));
  view.setUint8(25, 0);
  view.setUint16(26, input.scriptKnown, true);
  view.setUint16(28, input.scriptUnknown, true);
  view.setUint16(30, input.scriptWeight, true);
  view.setUint16(32, input.ipcFrames, true);
  view.setUint32(34, input.capsuleBytes, true);
  view.setUint16(38, input.schedulerTicks, true);

  view.setUint32(SIGNATURE_OFFSET, fnv1a32(signatureBytes(bytes)), true);
  return bytes;
}
