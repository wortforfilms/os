export type LipiDirection = "LTR" | "RTL" | "TTB" | "BTT" | "MIXED";

export type LipiStatus =
  | "ACTIVE"
  | "HISTORICAL"
  | "ENDANGERED"
  | "EXTINCT"
  | "ENCODED"
  | "UNENCODED"
  | "BLOCKED";

export type LipiWave = "WAVE_1_CLASSICAL" | "WAVE_2_REGIONAL" | "WAVE_3_COMMERCIAL" | "EXTENSION";

/**
 * Finer-grained endangerment vitality, as classified by the cited authority.
 * This is intentionally distinct from {@link LipiStatus}: the runtime status of a
 * seeded endangered script is the coarse "ENDANGERED", while `vitality` carries
 * the honest source-claim classification (e.g. EXTINCT vs DORMANT vs REVIVING).
 */
export type LipiVitality = "ENDANGERED" | "EXTINCT" | "DORMANT" | "REVIVING";

/**
 * A single provenance citation. Copied verbatim from the provenance-backed
 * research dataset; never invented. `url` may be a source landing page.
 */
export interface LipiProvenanceCitation {
  sourceId: string;
  url: string;
  note: string;
}

/**
 * Review posture for a seeded record. PHKD default is CONTROLLED_NO_GO:
 * a source-claim record pending native/specialist review, never certified.
 */
export type LipiReviewState = "CONTROLLED_NO_GO";

export interface LipiScriptRecord {
  id: string;
  isoCode: string;
  name: string;
  nativeName?: string;
  direction: LipiDirection;
  family?: string;
  wave?: LipiWave;
  status: LipiStatus;
  unicodeRange?: string;
  region?: string;
  purpose?: string;
  oldestProof?: string;
  extinctionReason?: string;
  creatorType?: string;
  creatorName?: string;
  // --- Optional endangerment metadata (backward-compatible) -----------------
  /** Finer source-claim vitality; distinct from the coarse runtime `status`. */
  vitality?: LipiVitality;
  /** Human-readable basis for the vitality classification, quoting the source. */
  vitalityBasis?: string;
  /** Provenance citations copied from the research dataset; never fabricated. */
  provenance?: LipiProvenanceCitation[];
  /** Review posture; CONTROLLED_NO_GO for seeded, un-reviewed records. */
  reviewState?: LipiReviewState;
}
