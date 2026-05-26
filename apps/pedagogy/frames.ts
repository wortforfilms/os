export const PEDG_FRAME_BYTES = 32;
export const PEDG_FRAME_MAGIC = Object.freeze([0x50, 0x45, 0x44, 0x47] as const);

export type PedgFrameInput = {
  profileHash: Uint8Array;
  milestoneMask: bigint;
  assessmentScore: number;
  knowledgeTokens: number;
  integrityBlock: Uint8Array;
};

export function encodePedgFrame(input: PedgFrameInput): Uint8Array {
  if (input.profileHash.byteLength !== 8) {
    throw new Error("profileHash must be 8 bytes");
  }
  if (input.integrityBlock.byteLength !== 4) {
    throw new Error("integrityBlock must be 4 bytes");
  }

  const frame = new Uint8Array(PEDG_FRAME_BYTES);
  const view = new DataView(frame.buffer);
  frame.set(PEDG_FRAME_MAGIC, 0);
  frame.set(input.profileHash, 4);
  view.setBigUint64(12, input.milestoneMask, true);
  view.setUint32(20, input.assessmentScore, true);
  view.setUint32(24, input.knowledgeTokens, true);
  frame.set(input.integrityBlock, 28);
  return frame;
}
