import type { KbsClaim, KbsSource } from "../types.ts";
import { stableHash } from "../provenance/index.ts";

export function normalizeSource(source: Omit<KbsSource, "hash">): KbsSource {
  return { ...source, hash: stableHash(source) };
}

export function normalizeClaim(claim: KbsClaim): KbsClaim {
  return {
    ...claim,
    text: claim.text.trim(),
    domain: claim.domain.trim(),
    citations: claim.citations.map((citation) => ({ ...citation, hash: citation.hash ?? stableHash(citation) }))
  };
}
