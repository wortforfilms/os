export const HARDWARE_TELEMETRY_FRAME_BYTES = 20;
export const GOLD_MASTER_STATUS_WORD = 0x001b004f;
export const ACOUSTIC_STRIKE_REQUIRED = 0x01;

export interface HardwareTelemetryFrame {
  timestampHst: bigint;
  activeScriptCount: number;
  statusWord: number;
  acousticStrikeFlag: number;
}

export class HardwareTelemetryRecoveryError extends Error {
  readonly recovery = true;

  constructor(message: string) {
    super(message);
    this.name = "HardwareTelemetryRecoveryError";
  }
}

export function parseHardwareTelemetryBlock(buffer: ArrayBufferLike | Uint8Array): HardwareTelemetryFrame {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.byteLength !== HARDWARE_TELEMETRY_FRAME_BYTES) {
    throw new HardwareTelemetryRecoveryError(`hardware telemetry frame size mismatch: ${bytes.byteLength}`);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const timestampHst = view.getBigUint64(0, true);
  const activeScriptCount = view.getUint32(8, true);
  const statusWord = view.getUint32(12, true);
  const acousticStrikeFlag = view.getUint8(16);

  if (timestampHst === 0n) {
    throw new HardwareTelemetryRecoveryError("hardware telemetry timestamp baseline missing");
  }

  if (activeScriptCount === 0) {
    throw new HardwareTelemetryRecoveryError("hardware telemetry active script vector empty");
  }

  if (statusWord !== GOLD_MASTER_STATUS_WORD) {
    throw new HardwareTelemetryRecoveryError(
      `hardware drift detected in state metric 0x${statusWord.toString(16).toUpperCase().padStart(8, "0")}`,
    );
  }

  if ((acousticStrikeFlag & ACOUSTIC_STRIKE_REQUIRED) !== ACOUSTIC_STRIKE_REQUIRED) {
    throw new HardwareTelemetryRecoveryError("hardware telemetry acoustic strike flag missing");
  }

  return {
    timestampHst,
    activeScriptCount,
    statusWord,
    acousticStrikeFlag,
  };
}

export function createHardwareTelemetryBlock(frame: HardwareTelemetryFrame): Uint8Array {
  if (frame.timestampHst === 0n) {
    throw new HardwareTelemetryRecoveryError("cannot encode zero HST timestamp");
  }
  if (!Number.isInteger(frame.activeScriptCount) || frame.activeScriptCount < 1) {
    throw new HardwareTelemetryRecoveryError("cannot encode empty script vector");
  }
  if (!Number.isInteger(frame.statusWord) || frame.statusWord < 0 || frame.statusWord > 0xffff_ffff) {
    throw new HardwareTelemetryRecoveryError("cannot encode invalid status word");
  }
  if (!Number.isInteger(frame.acousticStrikeFlag) || frame.acousticStrikeFlag < 0 || frame.acousticStrikeFlag > 0xff) {
    throw new HardwareTelemetryRecoveryError("cannot encode invalid acoustic strike flag");
  }

  const bytes = new Uint8Array(HARDWARE_TELEMETRY_FRAME_BYTES);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(0, frame.timestampHst, true);
  view.setUint32(8, frame.activeScriptCount, true);
  view.setUint32(12, frame.statusWord, true);
  view.setUint8(16, frame.acousticStrikeFlag);
  return bytes;
}
