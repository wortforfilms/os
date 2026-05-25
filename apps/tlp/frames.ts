export const TLPS_FRAME_BYTES = 64;
export const TLPA_FRAME_BYTES = 48;

export type TlpsFrameInput = {
  phaseHash: Uint8Array;
  startTimestamp: bigint;
  endTimestamp: bigint;
  conflictMask: number;
  stateFlag: number;
};

export type TlpaFrameInput = {
  ledgerHash: Uint8Array;
  balanceVector: Uint8Array;
  statutoryCategory: number;
  immutabilityMask: number;
  signatureBlock: Uint8Array;
};

function assertBytes(name: string, value: Uint8Array, bytes: number) {
  if (value.byteLength !== bytes) {
    throw new Error(`${name} must be ${bytes} bytes`);
  }
}

export function encodeTlpsFrame(input: TlpsFrameInput): Uint8Array {
  assertBytes("phaseHash", input.phaseHash, 16);
  const frame = new Uint8Array(TLPS_FRAME_BYTES);
  const view = new DataView(frame.buffer);
  frame.set([0x54, 0x4c, 0x50, 0x53], 0);
  frame.set(input.phaseHash, 4);
  view.setBigUint64(20, input.startTimestamp, true);
  view.setBigUint64(28, input.endTimestamp, true);
  view.setUint32(36, input.conflictMask, true);
  view.setUint16(40, input.stateFlag, true);
  return frame;
}

export function encodeTlpaFrame(input: TlpaFrameInput): Uint8Array {
  assertBytes("ledgerHash", input.ledgerHash, 16);
  assertBytes("balanceVector", input.balanceVector, 16);
  assertBytes("signatureBlock", input.signatureBlock, 4);
  const frame = new Uint8Array(TLPA_FRAME_BYTES);
  const view = new DataView(frame.buffer);
  frame.set([0x54, 0x4c, 0x50, 0x41], 0);
  frame.set(input.ledgerHash, 4);
  frame.set(input.balanceVector, 20);
  view.setUint32(36, input.statutoryCategory, true);
  view.setUint32(40, input.immutabilityMask, true);
  frame.set(input.signatureBlock, 44);
  return frame;
}
