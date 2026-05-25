const FRAME_BYTES = 40;
const SIGNED_BYTES = 36;
const MAGIC = 0x46534f4d;

function fnv1a32(buffer) {
  let hash = 0x811c9dc5;
  for (const byte of buffer.subarray(0, SIGNED_BYTES)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function assertU16(name, value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new RangeError(`native metric frame invalid ${name}`);
  }
}

function assertU32(name, value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new RangeError(`native metric frame invalid ${name}`);
  }
}

export function encodeNativeMetricFrame(input) {
  assertU32("uptimeTicks", input.uptimeTicks);
  assertU32("activeTasks", input.activeTasks);
  assertU16("hardwareCores", input.hardwareCores);
  assertU16("capsuleCount", input.capsuleCount);
  assertU32("aiBatchStatus", input.aiBatchStatus);

  if (!Number.isSafeInteger(input.allocatedMemoryBytes) || input.allocatedMemoryBytes < 0) {
    throw new RangeError("native metric frame invalid allocatedMemoryBytes");
  }

  const buffer = Buffer.alloc(FRAME_BYTES);
  buffer.writeUInt32LE(MAGIC, 0);
  buffer.writeUInt32LE(input.uptimeTicks, 4);
  buffer.writeBigUInt64LE(BigInt(input.allocatedMemoryBytes), 8);
  buffer.writeUInt32LE(input.activeTasks, 16);
  buffer.writeUInt16LE(input.hardwareCores, 20);
  buffer.writeUInt16LE(input.capsuleCount, 22);
  buffer.writeUInt32LE(input.aiBatchStatus, 24);
  buffer.writeUInt32LE(fnv1a32(buffer), 36);
  return buffer;
}

export const NATIVE_METRIC_FRAME = {
  bytes: FRAME_BYTES,
  signedBytes: SIGNED_BYTES,
  magic: MAGIC,
};
