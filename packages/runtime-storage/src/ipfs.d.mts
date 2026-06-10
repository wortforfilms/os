// Type declarations for the multiformats-only IPFS content-addressing module.

/** Compute the genuine IPFS CID (CIDv1 / raw / sha2-256) for bytes or a string. */
export function cidOf(input: Uint8Array | string): Promise<string>;

export interface IpfsHealth {
  kind: "ipfs";
  status: "active";
  blocks: number;
  network: false;
  scope: string;
}

/** Content-addressed store over a local blockstore (no public IPFS network). */
export class IpfsBlockStore {
  kind: "ipfs";
  blocks: Map<string, Uint8Array>;
  constructor(blockstore?: Map<string, Uint8Array>);
  static cidOf(input: Uint8Array | string): Promise<string>;
  put(input: Uint8Array | string): Promise<string>;
  get(cid: string): Promise<Uint8Array | null>;
  has(cid: string): Promise<boolean>;
  health(): IpfsHealth;
}
