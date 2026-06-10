import { freezeUnsupportedClaim } from "../../kbs-runtime/src/claims/index.ts";
import { kbsClaims, kbsSources } from "../../kbs-runtime/src/data.ts";
import { bindEvidenceHash } from "../../kbs-runtime/src/provenance/index.ts";
import { keywordSearch } from "../../kbs-runtime/src/search/index.ts";
import type { KbsClaim, KbsSource } from "../../kbs-runtime/src/types.ts";
import {
  addEvidence,
  addExperiment,
  assess,
  registerHypothesis,
  reset,
  type Status as ResearchStatus,
} from "../../runtime-research/src/index.ts";

export type ResearchAgentStatus = "LOCAL_PREVIEW" | "BLOCKED";

export type ResearchAgentFinding = {
  id: string;
  type: "claim" | "source";
  title: string;
  status: string;
  score: number;
};

export type ResearchAgentCycle = {
  agent: "maataa-research-agent";
  status: ResearchAgentStatus;
  query: string;
  discovered: ResearchAgentFinding[];
  analyzedClaim: {
    id: string;
    status: string;
    frozen: boolean;
    citationCount: number;
    evidenceCount: number;
    confidence: number;
  } | null;
  hypothesisId: string | null;
  assessment: {
    supportScore: number;
    status: ResearchStatus;
    for: number;
    against: number;
    experiments: number;
  } | null;
  evidenceHashes: string[];
  blockers: string[];
  autonomy: "LOCAL_KBS_ONLY";
  externalDiscovery: false;
  productionReady: false;
  phkdVerdict: "BLOCKED";
};

export type ResearchAgentResult =
  | { isOk: true; data: ResearchAgentCycle; error: null }
  | { isOk: false; data: ResearchAgentCycle; error: { code: string; detail: string } };

export type ResearchAgentInput = {
  query: string;
  claims?: KbsClaim[];
  sources?: KbsSource[];
};

export function runResearchAgentCycle(input: ResearchAgentInput): ResearchAgentResult {
  const query = input.query?.trim();
  if (!query) {
    return blockedCycle("", "empty_query", "Research agent requires a non-empty local KBS query.");
  }

  const claims = input.claims ?? kbsClaims;
  const sources = input.sources ?? kbsSources;
  const discovered = keywordSearch(query, claims, sources).map((item) => ({ ...item }));
  const claimHit = discovered.find((item) => item.type === "claim");
  const claim = claimHit ? claims.find((item) => item.id === claimHit.id) ?? null : null;
  if (!claim) {
    return blockedCycle(query, "no_local_claim", "No local KBS claim matched the query.");
  }

  reset();
  const frozenClaim = freezeUnsupportedClaim(claim, sources);
  const hypothesis = registerHypothesis(frozenClaim.text);
  if (!hypothesis.isOk) {
    return blockedCycle(query, hypothesis.error.code, hypothesis.error.detail, discovered);
  }

  addExperiment(hypothesis.data.id, "local-kbs-keyword-search", `query=${query}; matches=${discovered.length}`);
  const evidenceHashes = frozenClaim.evidenceIds.map((id) => bindEvidenceHash({ id }, { claimId: frozenClaim.id, query }).hash);
  const trustWeight = evidenceWeightForClaim(frozenClaim, sources);
  addEvidence(hypothesis.data.id, {
    ref: evidenceHashes[0] ?? `claim:${frozenClaim.id}`,
    weight: trustWeight.weight,
    supports: trustWeight.supports,
  });

  const assessment = assess(hypothesis.data.id);
  if (!assessment.isOk) {
    return blockedCycle(query, assessment.error.code, assessment.error.detail, discovered);
  }

  const blockers = [
    "external discovery is disabled; local KBS records only",
    "support score is advisory and does not decide truth",
    "production readiness remains blocked until global PHKD gates pass",
  ];
  if (frozenClaim.frozen) {
    blockers.push(frozenClaim.blockedReason ?? "claim is frozen by KBS governance");
  }

  return {
    isOk: true,
    data: {
      agent: "maataa-research-agent",
      status: "LOCAL_PREVIEW",
      query,
      discovered,
      analyzedClaim: {
        id: frozenClaim.id,
        status: frozenClaim.status,
        frozen: frozenClaim.frozen,
        citationCount: frozenClaim.citations.length,
        evidenceCount: frozenClaim.evidenceIds.length,
        confidence: frozenClaim.confidence,
      },
      hypothesisId: hypothesis.data.id,
      assessment: assessment.data,
      evidenceHashes,
      blockers,
      autonomy: "LOCAL_KBS_ONLY",
      externalDiscovery: false,
      productionReady: false,
      phkdVerdict: "BLOCKED",
    },
    error: null,
  };
}

export function researchAgentHealth() {
  return {
    agent: "maataa-research-agent",
    status: "LOCAL_PREVIEW" as const,
    capabilities: ["discover-local-kbs-records", "analyze-claim-lineage", "validate-with-advisory-support-score"],
    externalDiscovery: false as const,
    productionReady: false as const,
    phkdVerdict: "BLOCKED" as const,
    blockers: [
      "no web-scale autonomous discovery",
      "no production trust claim",
      "global PHKD gates remain blocked",
    ],
  };
}

function evidenceWeightForClaim(claim: KbsClaim, sources: KbsSource[]): { weight: number; supports: boolean } {
  if (claim.status === "BLOCKED" || claim.frozen) {
    return { weight: 1, supports: false };
  }
  const linkedSources = claim.citations.map((citation) => sources.find((source) => source.id === citation.sourceId));
  const highTrust = linkedSources.filter((source) => source?.trustLevel === "HIGH").length;
  const blocked = linkedSources.some((source) => !source || source.trustLevel === "BLOCKED");
  if (blocked) {
    return { weight: 1, supports: false };
  }
  return {
    weight: Math.max(1, highTrust + claim.evidenceIds.length),
    supports: claim.confidence >= 0.5 && highTrust > 0 && claim.evidenceIds.length > 0,
  };
}

function blockedCycle(
  query: string,
  code: string,
  detail: string,
  discovered: ResearchAgentFinding[] = [],
): ResearchAgentResult {
  const data: ResearchAgentCycle = {
    agent: "maataa-research-agent",
    status: "BLOCKED",
    query,
    discovered,
    analyzedClaim: null,
    hypothesisId: null,
    assessment: null,
    evidenceHashes: [],
    blockers: [detail],
    autonomy: "LOCAL_KBS_ONLY",
    externalDiscovery: false,
    productionReady: false,
    phkdVerdict: "BLOCKED",
  };
  return { isOk: false, data, error: { code, detail } };
}
