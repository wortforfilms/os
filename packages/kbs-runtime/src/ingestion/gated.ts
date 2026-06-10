// Entitlement-gated KBS ingestion (boundary enforced IN-FLOW).
//
// Every ingested record is metered against the account's SKU storage quota via
// @maataa/runtime-entitlements. consume() is the gate:
//   - within quota  → record is accepted, storage usage incremented, and a REAL
//     IPFS CID provenance is attached (@maataa/runtime-storage).
//   - over quota     → REJECTED, fail-closed. Nothing is ingested and usage is
//     NOT incremented (consume() denies without mutating).
//
// This turns the entitlement boundary from "available" into "enforced-in-flow":
// you cannot ingest past the cap.
import type { KbsClaim, KbsSource } from "../types.ts";
import { normalizeSource, normalizeClaim } from "./index.ts";
import { bindContentAddress, canonicalize } from "../provenance/content-address.ts";

// Structural dependency on the entitlement boundary — KBS does not import the
// entitlements package source (keeps low coupling and a clean rootDir). The real
// @maataa/runtime-entitlements EntitlementRuntime satisfies this shape.
export type EntitlementResource = "seats" | "devices" | "storageBytes";

export interface EntitlementDecision {
  allowed: boolean;
  accountId: string;
  resource: EntitlementResource;
  requested: number;
  current: number;
  limit: number;
  remaining: number;
  reason: string;
}

export interface EntitlementGate {
  consume(accountId: string, resource: EntitlementResource, amount?: number): EntitlementDecision;
}

export interface IngestResult<T> {
  accepted: boolean;
  reason: string;
  bytes: number;
  decision: EntitlementDecision;
  record?: T & { hash: string; cid: string };
}

/** Byte size of a record's canonical serialization (deterministic). */
export function recordBytes(record: unknown): number {
  return new TextEncoder().encode(canonicalize(record)).length;
}

/** Ingestion gate bound to one account's entitlements. */
export class GatedIngestion {
  private readonly entitlements: EntitlementGate;
  private readonly accountId: string;

  constructor(entitlements: EntitlementGate, accountId: string) {
    this.entitlements = entitlements;
    this.accountId = accountId;
  }

  private async gate<T extends { id: string; hash?: string }>(normalized: T): Promise<IngestResult<T>> {
    const bytes = recordBytes(normalized);
    const decision = this.entitlements.consume(this.accountId, "storageBytes", bytes);
    if (!decision.allowed) {
      return { accepted: false, reason: decision.reason, bytes, decision };
    }
    const record = await bindContentAddress(normalized);
    return { accepted: true, reason: "within storage quota", bytes, decision, record };
  }

  /** Ingest a source: normalize → meter against quota → (accept + CID) | deny. */
  async ingestSource(source: Omit<KbsSource, "hash">): Promise<IngestResult<KbsSource>> {
    return this.gate(normalizeSource(source));
  }

  /** Ingest a claim: normalize → meter against quota → (accept + CID) | deny. */
  async ingestClaim(claim: KbsClaim): Promise<IngestResult<KbsClaim>> {
    return this.gate(normalizeClaim(claim));
  }
}
