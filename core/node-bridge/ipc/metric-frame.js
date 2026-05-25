const FRAME_BYTES = 40;
const MAGIC = 0x4d4f5346;
const VERSION = 1;
const SIGNATURE_OFFSET = 12;

function fnv1a32(buffer) {
  let hash = 0x811c9dc5;
  for (const byte of buffer) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function signatureBuffer(buffer) {
  const copy = Buffer.from(buffer.subarray(0, FRAME_BYTES));
  copy.writeUInt32LE(0, SIGNATURE_OFFSET);
  return copy;
}

function assertU16(name, value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new RangeError(`native metric frame invalid ${name}`);
  }
}

function healthCode(status) {
  switch (status) {
    case "nominal":
      return 0;
    case "warning":
      return 1;
    case "critical":
      return 2;
    case "offline":
      return 3;
    default:
      throw new RangeError(`native metric frame invalid health: ${status}`);
  }
}

export function encodeNativeMetricFrame(input) {
  assertU16("hostThreads", input.hostThreads);
  assertU16("scriptKnown", input.scriptKnown);
  assertU16("scriptUnknown", input.scriptUnknown);
  assertU16("scriptWeight", input.scriptWeight);
  assertU16("ipcFrames", input.ipcFrames);
  assertU16("schedulerTicks", input.schedulerTicks);

  const buffer = Buffer.alloc(FRAME_BYTES);
  buffer.writeUInt32LE(MAGIC, 0);
  buffer.writeUInt16LE(VERSION, 4);
  buffer.writeUInt16LE(1, 6);
  buffer.writeUInt16LE(FRAME_BYTES, 8);
  buffer.writeUInt16LE(0, 10);
  buffer.writeUInt32LE(input.sequence ?? 1, 16);
  buffer.writeUInt16LE(input.hostThreads, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt8(healthCode(input.health), 24);
  buffer.writeUInt8(0, 25);
  buffer.writeUInt16LE(input.scriptKnown, 26);
  buffer.writeUInt16LE(input.scriptUnknown, 28);
  buffer.writeUInt16LE(input.scriptWeight, 30);
  buffer.writeUInt16LE(input.ipcFrames, 32);
  buffer.writeUInt32LE(input.capsuleBytes, 34);
  buffer.writeUInt16LE(input.schedulerTicks, 38);
  buffer.writeUInt32LE(fnv1a32(signatureBuffer(buffer)), SIGNATURE_OFFSET);
  return buffer;
}

export const NATIVE_METRIC_FRAME = {
  bytes: FRAME_BYTES,
  magic: MAGIC,
  version: VERSION,
};
