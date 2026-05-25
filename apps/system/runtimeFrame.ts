export const NATIVE_METRIC_FRAME_BYTES = 40;
export const NATIVE_METRIC_FRAME_MAGIC = 0x46534f4d;
export const NATIVE_METRIC_FRAME_SIGNED_BYTES = 36;
export const NATIVE_METRIC_RECOVERY_AI_STATUS = 0x8000_0001;

const CHECKSUM_OFFSET = 36;

export type NativeMetricFrame = {
  magic: typeof NATIVE_METRIC_FRAME_MAGIC;
  uptimeTicks: number;
  allocatedMemoryBytes: number;
  activeTasks: number;
  hardwareCores: number;
  capsuleCount: number;
  aiBatchStatus: number;
  reserved: readonly number[];
  checksum: number;
};

export interface ExtendedApplianceData {
  uptime: number;
  allocatedMemory: bigint;
  activeTasks: number;
  hardwareCores: number;
  capsuleCount: number;
  aiBatchStatus: number;
  terminalMode: number;
  radioStreaming: boolean;
}

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

function assertU16(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new RecoveryFrameError(`native metric frame invalid ${name}`);
  }
}

function assertU32(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new RecoveryFrameError(`native metric frame invalid ${name}`);
  }
}

export function parseNativeMetricFrame(input: Uint8Array | ArrayBufferLike): NativeMetricFrame {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength !== NATIVE_METRIC_FRAME_BYTES) {
    throw new RecoveryFrameError(`native metric frame size mismatch: ${bytes.byteLength}`);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = view.getUint32(0, true);
  const checksum = view.getUint32(CHECKSUM_OFFSET, true);
  const expectedChecksum = fnv1a32(bytes.slice(0, NATIVE_METRIC_FRAME_SIGNED_BYTES));

  if (magic !== NATIVE_METRIC_FRAME_MAGIC) {
    throw new RecoveryFrameError("native metric frame magic mismatch");
  }

  if (checksum !== expectedChecksum) {
    throw new RecoveryFrameError("native metric frame checksum mismatch");
  }

  const uptimeTicks = view.getUint32(4, true);
  const allocatedMemoryBytes = Number(view.getBigUint64(8, true));
  const activeTasks = view.getUint32(16, true);
  const hardwareCores = view.getUint16(20, true);
  const capsuleCount = view.getUint16(22, true);
  const aiBatchStatus = view.getUint32(24, true);

  if (activeTasks < 1 || hardwareCores < 1) {
    throw new RecoveryFrameError("native metric frame invalid scheduler bounds");
  }

  if (!Number.isSafeInteger(allocatedMemoryBytes)) {
    throw new RecoveryFrameError("native metric frame memory value exceeds safe frontend integer");
  }

  return {
    magic,
    uptimeTicks,
    allocatedMemoryBytes,
    activeTasks,
    hardwareCores,
    capsuleCount,
    aiBatchStatus,
    reserved: Array.from(bytes.slice(28, 36)),
    checksum,
  };
}

export function parseExtendedFrame(input: Uint8Array | ArrayBufferLike): ExtendedApplianceData {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const frame = parseNativeMetricFrame(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  return {
    uptime: frame.uptimeTicks,
    allocatedMemory: view.getBigUint64(8, true),
    activeTasks: frame.activeTasks,
    hardwareCores: frame.hardwareCores,
    capsuleCount: frame.capsuleCount,
    aiBatchStatus: frame.aiBatchStatus,
    terminalMode: bytes[28],
    radioStreaming: bytes[29] === 1,
  };
}

export function createNativeMetricFrame(input: {
  uptimeTicks: number;
  allocatedMemoryBytes: number;
  activeTasks: number;
  hardwareCores: number;
  capsuleCount: number;
  aiBatchStatus: number;
  terminalMode?: number;
  radioStreaming?: boolean;
}): Uint8Array {
  assertU32("uptimeTicks", input.uptimeTicks);
  assertU32("activeTasks", input.activeTasks);
  assertU16("hardwareCores", input.hardwareCores);
  assertU16("capsuleCount", input.capsuleCount);
  assertU32("aiBatchStatus", input.aiBatchStatus);

  if (!Number.isSafeInteger(input.allocatedMemoryBytes) || input.allocatedMemoryBytes < 0) {
    throw new RecoveryFrameError("native metric frame invalid allocatedMemoryBytes");
  }

  const bytes = new Uint8Array(NATIVE_METRIC_FRAME_BYTES);
  const view = new DataView(bytes.buffer);

  view.setUint32(0, NATIVE_METRIC_FRAME_MAGIC, true);
  view.setUint32(4, input.uptimeTicks, true);
  view.setBigUint64(8, BigInt(input.allocatedMemoryBytes), true);
  view.setUint32(16, input.activeTasks, true);
  view.setUint16(20, input.hardwareCores, true);
  view.setUint16(22, input.capsuleCount, true);
  view.setUint32(24, input.aiBatchStatus, true);
  bytes[28] = input.terminalMode ?? 0;
  bytes[29] = input.radioStreaming ? 1 : 0;
  view.setUint32(CHECKSUM_OFFSET, fnv1a32(bytes.slice(0, NATIVE_METRIC_FRAME_SIGNED_BYTES)), true);
  return bytes;
}
