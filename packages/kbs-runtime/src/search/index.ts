import type { KbsClaim, KbsSource } from "../types.ts";

export interface KbsSearchResult {
  id: string;
  type: "claim" | "source";
  title: string;
  status: string;
  score: number;
}

export function keywordSearch(query: string, claims: KbsClaim[], sources: KbsSource[]): KbsSearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const claimResults = claims
    .filter((claim) => `${claim.text} ${claim.domain}`.toLowerCase().includes(normalized))
    .map((claim) => ({ id: claim.id, type: "claim" as const, title: claim.text, status: claim.status, score: claim.confidence }));
  const sourceResults = sources
    .filter((source) => `${source.title} ${source.type} ${source.author ?? ""}`.toLowerCase().includes(normalized))
    .map((source) => ({ id: source.id, type: "source" as const, title: source.title, status: source.status, score: source.trustLevel === "HIGH" ? 1 : 0.5 }));
  return [...claimResults, ...sourceResults].sort((a, b) => b.score - a.score);
}

export function citationSearch(query: string, claims: KbsClaim[]) {
  const normalized = query.trim().toLowerCase();
  return claims.filter((claim) =>
    claim.citations.some((citation) => `${citation.sourceId} ${citation.locator} ${citation.quote ?? ""}`.toLowerCase().includes(normalized))
  );
}

export function semanticSearch(query: string, claims: KbsClaim[], sources: KbsSource[]) {
  return keywordSearch(query, claims, sources);
}
