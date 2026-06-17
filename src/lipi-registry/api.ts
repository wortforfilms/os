import seedDataset from "../../data/hkd-lipi-script-registry-seed-426.json" with { type: "json" };
import architecture from "../../data/hkd-lipi-registry-architecture.json" with { type: "json" };
import numeralRegistry from "../../data/hkd-lipi-numeral-registry.json" with { type: "json" };
import zeroRegistry from "../../data/hkd-lipi-zero-registry.json" with { type: "json" };
import familyGraph from "../../data/hkd-lipi-script-family-graph.json" with { type: "json" };
import unicodeCrosswalk from "../../data/hkd-lipi-unicode-crosswalk.json" with { type: "json" };
import kbsGraph from "../../data/hkd-lipi-kbs-graph.json" with { type: "json" };
import auditReport from "../../release/evidence/hkd-lipi-registry-audit-report.json" with { type: "json" };
import provenanceReport from "../../release/evidence/hkd-lipi-registry-provenance-report.json" with { type: "json" };
import sourceRegistry from "../../data/hkd-lipi-federated-source-registry.json" with { type: "json" };
import evidenceLineageGraph from "../../data/hkd-lipi-evidence-lineage-graph.json" with { type: "json" };
import sourceConflictDetector from "../../data/hkd-lipi-source-conflict-detector.json" with { type: "json" };
import provenanceChainExplorer from "../../data/hkd-lipi-provenance-chain-explorer.json" with { type: "json" };
import federationEvidence from "../../release/evidence/hkd-lipi-registry-phase6-federation.json" with { type: "json" };
import sourceAdapterContracts from "../../data/hkd-lipi-source-adapter-contracts.json" with { type: "json" };
import ingestionPolicy from "../../data/hkd-lipi-ingestion-policy.json" with { type: "json" };
import sourceTrustMatrix from "../../data/hkd-lipi-source-trust-matrix.json" with { type: "json" };
import conflictResolutionRules from "../../data/hkd-lipi-conflict-resolution-rules.json" with { type: "json" };
import ingestionContractsEvidence from "../../release/evidence/hkd-lipi-registry-phase7-ingestion-contracts.json" with { type: "json" };
import ingestionDryRunReport from "../../data/hkd-lipi-ingestion-dry-run-report.json" with { type: "json" };
import ingestionFieldDiffPreview from "../../data/hkd-lipi-ingestion-field-diff-preview.json" with { type: "json" };
import ingestionBlockers from "../../data/hkd-lipi-ingestion-blockers.json" with { type: "json" };
import dryRunIngestionEvidence from "../../release/evidence/hkd-lipi-registry-phase8-dry-run-ingestion.json" with { type: "json" };
import iso15924IngestionReport from "../../data/iso15924-ingestion-report.json" with { type: "json" };
import iso15924ScriptCodeCrosswalk from "../../data/iso15924-script-code-crosswalk.json" with { type: "json" };
import iso15924DiffPreview from "../../data/iso15924-diff-preview.json" with { type: "json" };
import iso15924Blockers from "../../data/iso15924-blockers.json" with { type: "json" };
import iso15924IngestionEvidence from "../../release/evidence/hkd-lipi-registry-phase9-iso15924-ingestion.json" with { type: "json" };
import cldrIngestionReport from "../../data/cldr-ingestion-report.json" with { type: "json" };
import cldrScriptLocaleCrosswalk from "../../data/cldr-script-locale-crosswalk.json" with { type: "json" };
import cldrDiffPreview from "../../data/cldr-diff-preview.json" with { type: "json" };
import cldrBlockers from "../../data/cldr-blockers.json" with { type: "json" };
import cldrIngestionEvidence from "../../release/evidence/hkd-lipi-registry-phase10-cldr-ingestion.json" with { type: "json" };
import icuIngestionReport from "../../data/icu-ingestion-report.json" with { type: "json" };
import icuScriptMetadataCrosswalk from "../../data/icu-script-metadata-crosswalk.json" with { type: "json" };
import icuDiffPreview from "../../data/icu-diff-preview.json" with { type: "json" };
import icuBlockers from "../../data/icu-blockers.json" with { type: "json" };
import icuIngestionEvidence from "../../release/evidence/hkd-lipi-registry-phase11-icu-ingestion.json" with { type: "json" };
import harfbuzzOpenTypeDryRunReport from "../../data/hkd-lipi-harfbuzz-opentype-dry-ingestion-report.json" with { type: "json" };
import harfbuzzOpenTypeDiffPreview from "../../data/hkd-lipi-harfbuzz-opentype-diff-preview.json" with { type: "json" };
import harfbuzzOpenTypeBlockers from "../../data/hkd-lipi-harfbuzz-opentype-blockers.json" with { type: "json" };
import harfbuzzOpenTypeEvidence from "../../release/evidence/hkd-lipi-registry-phase12-harfbuzz-opentype.json" with { type: "json" };
import conflictAuthorityAudit from "../../data/hkd-lipi-cross-source-conflict-authority-audit.json" with { type: "json" };
import conflictAuthorityEvidence from "../../release/evidence/hkd-lipi-registry-phase13-authority-audit.json" with { type: "json" };
import controlledEnrichmentProposals from "../../data/hkd-lipi-controlled-enrichment-proposals.json" with { type: "json" };
import controlledEnrichmentEvidence from "../../release/evidence/hkd-lipi-registry-phase14-controlled-enrichment.json" with { type: "json" };
import runtimeGateReview from "../../data/hkd-lipi-runtime-enablement-gate-review.json" with { type: "json" };
import runtimeGateEvidence from "../../release/evidence/hkd-lipi-registry-phase15-runtime-gate-review.json" with { type: "json" };
import releaseCandidateEvidenceIndex from "../../data/hkd-lipi-release-candidate-evidence-index.json" with { type: "json" };
import releaseCandidateEvidenceBundle from "../../release/evidence/hkd-lipi-registry-phase16-release-candidate-evidence-bundle.json" with { type: "json" };
import operatorRunbook from "../../data/hkd-lipi-operator-runbook.json" with { type: "json" };
import operatorRunbookEvidence from "../../release/evidence/hkd-lipi-registry-phase17-operator-runbook.json" with { type: "json" };
import externalReviewPackage from "../../data/hkd-lipi-external-review-package.json" with { type: "json" };
import externalReviewEvidence from "../../release/evidence/hkd-lipi-registry-phase18-external-review-package.json" with { type: "json" };
import productionGoApprovalGate from "../../data/hkd-lipi-production-go-approval-gate.json" with { type: "json" };
import productionGoApprovalEvidence from "../../release/evidence/hkd-lipi-registry-phase19-production-go-gate.json" with { type: "json" };
import runtimeActivationEvidence from "../../release/evidence/hkd-lipi-registry-runtime-activation.json" with { type: "json" };
import renderingCorpus from "../../data/lipi-rendering-corpus/index.json" with { type: "json" };
import fontFixtureManifest from "../../data/lipi-font-fixtures/manifest.json" with { type: "json" };
import glyphBaselineManifest from "../../data/lipi-glyph-baselines/manifest.json" with { type: "json" };
import renderingValidationEvidence from "../../release/evidence/hkd-lipi-rendering-validation.json" with { type: "json" };
import fontValidationEvidence from "../../release/evidence/hkd-lipi-font-validation.json" with { type: "json" };
import shapingValidationEvidence from "../../release/evidence/hkd-lipi-shaping-validation.json" with { type: "json" };
import harfbuzzRenderReport from "../../release/evidence/hkd-lipi-harfbuzz-render-report.json" with { type: "json" };
import browserRenderReport from "../../release/evidence/hkd-lipi-browser-render-report.json" with { type: "json" };
import openTypeRenderReport from "../../release/evidence/hkd-lipi-opentype-render-report.json" with { type: "json" };
import harfbuzzEnvironment from "../../release/evidence/hkd-lipi-harfbuzz-environment.json" with { type: "json" };
import harfbuzzAvailability from "../../release/evidence/hkd-lipi-harfbuzz-availability.json" with { type: "json" };
import harfbuzzShapingEvidence from "../../release/evidence/hkd-lipi-harfbuzz-shaping-evidence.json" with { type: "json" };
import glyphBaselineCaptures from "../../release/evidence/hkd-lipi-glyph-baseline-captures.json" with { type: "json" };
import renderDiffReport from "../../release/evidence/hkd-lipi-render-diff-report.json" with { type: "json" };
import fontCoverageReport from "../../release/evidence/hkd-lipi-font-coverage-report.json" with { type: "json" };
import phase24CrossBrowserValidation from "../../release/evidence/hkd-lipi-registry-phase24-cross-browser-validation.json" with { type: "json" };
import phase25CrossPlatformValidation from "../../release/evidence/hkd-lipi-registry-phase25-cross-platform-validation.json" with { type: "json" };
import phase26ExternalReviewHumanApproval from "../../release/evidence/hkd-lipi-registry-phase26-external-review-human-approval.json" with { type: "json" };
import phase27ProductionGoDecision from "../../release/evidence/hkd-lipi-registry-phase27-production-go-decision.json" with { type: "json" };
import platformAttestation from "../../release/evidence/hkd-lipi-platform-attestation.json" with { type: "json" };
import type { HkdLipiScriptRegistryRecord } from "../../packages/lipi-runtime/src/registry/hkd-lipi-registry-types.ts";

export type LipiRegistryApiStatus = "CONTROLLED_NO_GO";
export type LipiRegistryRuntimeActivationStatus = "CONTROLLED_PREVIEW_NO_GO";
export type LipiRegistryBadgeTone = "verified" | "blocked" | "draft" | "unknown" | "neutral";

export type LipiRegistryBadge = {
  label: string;
  value: string;
  tone: LipiRegistryBadgeTone;
};

export type LipiRegistryListQuery = {
  q?: string;
  registryClass?: string | "all";
  unicodeStatus?: string | "all";
  evidenceStatus?: string | "all";
  scriptFamily?: string | "all";
  limit?: number;
};

export type LipiRegistryStats = {
  total: number;
  byClass: Record<string, number>;
  byUnicodeStatus: Record<string, number>;
  byEvidenceStatus: Record<string, number>;
  runtimeEnabled: number;
  rowsWithUnicodeRanges: number;
  rowsWithKnownZeroGlyph: number;
  rowsWithDigitInventory: number;
  kbsNodes: number;
  kbsEdges: number;
};

export type LipiRegistryListResponse = {
  ok: true;
  reviewState: LipiRegistryApiStatus;
  governedProductionGo: false;
  productionReady: false;
  total: number;
  returned: number;
  stats: LipiRegistryStats;
  records: HkdLipiScriptRegistryRecord[];
};

export type LipiRegistryRecordResponse =
  | {
      ok: true;
      reviewState: LipiRegistryApiStatus;
      governedProductionGo: false;
      productionReady: false;
      record: HkdLipiScriptRegistryRecord;
      badges: LipiRegistryBadge[];
      relatedRecords: HkdLipiScriptRegistryRecord[];
      apiLinks: Array<{ label: string; path: string }>;
    }
  | {
      ok: false;
      reviewState: LipiRegistryApiStatus;
      governedProductionGo: false;
      productionReady: false;
      error: "SCRIPT_NOT_FOUND";
      id: string;
    };

export type LipiNumeralZeroView = {
  ok: true;
  reviewState: LipiRegistryApiStatus;
  governedProductionGo: false;
  productionReady: false;
  summary: {
    total: number;
    rowsWithKnownZeroGlyph: number;
    rowsWithDigitInventory: number;
    rowsWithDecimalDigitsTrue: number;
    rowsStillUnknown: number;
  };
  rows: Array<{
    id: string;
    displayName: string;
    zeroGlyph: string;
    zeroCodePoint: string;
    digits: Array<{ value: number; glyph: string; codePoint: string; name: string; blockName: string }>;
    hasDecimalDigits: boolean;
    numeralSystemType: string;
    evidenceStatus: string;
    sourceRefs: string[];
  }>;
};

export type LipiUnicodeCrosswalkResponse = {
  ok: true;
  reviewState: LipiRegistryApiStatus;
  governedProductionGo: false;
  productionReady: false;
  total: number;
  rows: Array<{
    id: string;
    displayName: string;
    unicodeScriptValue: string;
    unicodeScriptAlias: string;
    iso15924: string;
    unicodeBlocks: Array<{ blockName: string; range: string; start: string; end: string }>;
    unicodeRanges: string[];
    scriptPropertyKind: string;
    evidenceStatus: string;
    fontSupportStatus: string;
    transliterationStatus: string;
  }>;
};

export type LipiFamilyGraphView = {
  ok: true;
  reviewState: LipiRegistryApiStatus;
  governedProductionGo: false;
  productionReady: false;
  summary: typeof familyGraph.summary;
  scriptNodes: typeof familyGraph.nodes.scripts;
  blockNodes: typeof familyGraph.nodes.blocks;
  scriptBlockEdges: typeof familyGraph.edges.scriptBlockEdges;
  genealogicalFamilyEdges: typeof familyGraph.edges.genealogicalFamilyEdges;
  blockedGenealogicalFamilyRelationships: typeof familyGraph.edges.blockedGenealogicalFamilyRelationships;
};

export type LipiKbsNode = (typeof kbsGraph.nodes)[number];
export type LipiKbsEdge = (typeof kbsGraph.edges)[number];

export type LipiKbsGraphView = {
  ok: true;
  reviewState: LipiRegistryApiStatus;
  governedProductionGo: false;
  productionReady: false;
  phkdVerdict: "CONTROLLED_NO_GO";
  summary: typeof kbsGraph.summary;
  nodes: readonly LipiKbsNode[];
  edges: readonly LipiKbsEdge[];
};

export type LipiKbsScriptNeighborhood = {
  ok: true;
  reviewState: LipiRegistryApiStatus;
  governedProductionGo: false;
  productionReady: false;
  phkdVerdict: "CONTROLLED_NO_GO";
  record: HkdLipiScriptRegistryRecord;
  scriptNode: LipiKbsNode | null;
  edges: LipiKbsEdge[];
  neighbors: LipiKbsNode[];
  blockedFields: typeof kbsGraph.summary.blockedFields;
  summary: {
    edgeCount: number;
    neighborCount: number;
    byEdgeType: Record<string, number>;
  };
};

export type LipiRegistryAuditabilityView = {
  ok: true;
  reviewState: LipiRegistryApiStatus;
  governedProductionGo: false;
  productionReady: false;
  phkdVerdict: "CONTROLLED_NO_GO";
  exportCenter: {
    artifactPaths: typeof auditReport.artifactPaths;
    outputHashes: typeof auditReport.outputHashes;
  };
  evidenceAudit: {
    schema: typeof auditReport.schema;
    inputCounts: typeof auditReport.inputCounts;
    checks: typeof auditReport.checks;
    failures: typeof auditReport.failures;
  };
  provenance: {
    schema: typeof provenanceReport.schema;
    counts: typeof provenanceReport.counts;
    evidenceSources: typeof provenanceReport.evidenceSources;
    orphanEvidenceReferences: typeof provenanceReport.orphanEvidenceReferences;
    nodesMissingProvenance: typeof provenanceReport.nodesMissingProvenance;
    edgesMissingProvenance: typeof provenanceReport.edgesMissingProvenance;
    nodesUnreachableFromProvenance: typeof provenanceReport.nodesUnreachableFromProvenance;
  };
  validator: {
    graphSummary: typeof kbsGraph.summary;
    checks: typeof auditReport.checks;
    failures: typeof auditReport.failures;
  };
  registryDiff: typeof auditReport.registryDiff;
};

export type LipiEvidenceFederationView = {
  ok: true;
  reviewState: LipiRegistryApiStatus;
  governedProductionGo: false;
  productionReady: false;
  phkdVerdict: "CONTROLLED_NO_GO";
  sourceRegistry: {
    summary: typeof sourceRegistry.summary;
    sources: typeof sourceRegistry.sources;
  };
  lineageGraph: {
    summary: typeof evidenceLineageGraph.summary;
    nodes: typeof evidenceLineageGraph.nodes;
    edges: typeof evidenceLineageGraph.edges;
  };
  conflictDetector: {
    summary: typeof sourceConflictDetector.summary;
    checks: typeof sourceConflictDetector.checks;
    localComparisons: typeof sourceConflictDetector.localComparisons;
    blockedComparisons: typeof sourceConflictDetector.blockedComparisons;
    conflicts: typeof sourceConflictDetector.conflicts;
  };
  provenanceChains: {
    summary: typeof provenanceChainExplorer.summary;
    sourceChains: typeof provenanceChainExplorer.sourceChains;
    scriptChains: typeof provenanceChainExplorer.scriptChains;
  };
  evidence: {
    counts: typeof federationEvidence.counts;
    checks: typeof federationEvidence.checks;
    limitations: typeof federationEvidence.limitations;
  };
};

export type LipiSourceIngestionContractsView = {
  ok: true;
  reviewState: LipiRegistryApiStatus;
  governedProductionGo: false;
  productionReady: false;
  phkdVerdict: "CONTROLLED_NO_GO";
  adapterContracts: {
    summary: typeof sourceAdapterContracts.summary;
    adapters: typeof sourceAdapterContracts.adapters;
  };
  ingestionPolicy: {
    policyId: typeof ingestionPolicy.policyId;
    adapterMode: typeof ingestionPolicy.adapterMode;
    allowedAdapterFieldStatuses: typeof ingestionPolicy.allowedAdapterFieldStatuses;
    allowedActions: typeof ingestionPolicy.allowedActions;
    forbiddenActions: typeof ingestionPolicy.forbiddenActions;
    fieldTransitionPolicy: typeof ingestionPolicy.fieldTransitionPolicy;
    adapterSummary: typeof ingestionPolicy.adapterSummary;
  };
  trustMatrix: {
    summary: typeof sourceTrustMatrix.summary;
    rows: typeof sourceTrustMatrix.rows;
  };
  conflictRules: {
    summary: typeof conflictResolutionRules.summary;
    rules: typeof conflictResolutionRules.rules;
  };
  evidence: {
    counts: typeof ingestionContractsEvidence.counts;
    checks: typeof ingestionContractsEvidence.checks;
    limitations: typeof ingestionContractsEvidence.limitations;
  };
};

export type LipiIngestionDryRunView = {
  ok: true;
  reviewState: LipiRegistryApiStatus;
  governedProductionGo: false;
  productionReady: false;
  phkdVerdict: "CONTROLLED_NO_GO";
  dryRunReport: {
    dryRun: typeof ingestionDryRunReport.dryRun;
    policySnapshot: typeof ingestionDryRunReport.policySnapshot;
    adapterRuns: typeof ingestionDryRunReport.adapterRuns;
  };
  fieldDiffPreview: {
    summary: typeof ingestionFieldDiffPreview.summary;
    previews: typeof ingestionFieldDiffPreview.previews;
  };
  blockers: {
    summary: typeof ingestionBlockers.summary;
    conflictPromotionPolicy: typeof ingestionBlockers.conflictPromotionPolicy;
    blockers: typeof ingestionBlockers.blockers;
  };
  evidence: {
    counts: typeof dryRunIngestionEvidence.counts;
    checks: typeof dryRunIngestionEvidence.checks;
    limitations: typeof dryRunIngestionEvidence.limitations;
  };
};

export type LipiIso15924IngestionView = {
  ok: true;
  reviewState: LipiRegistryApiStatus;
  governedProductionGo: false;
  productionReady: false;
  phkdVerdict: "CONTROLLED_NO_GO";
  report: {
    ingestion: typeof iso15924IngestionReport.ingestion;
    summary: typeof iso15924IngestionReport.summary;
    officialSource: typeof iso15924IngestionReport.officialSource;
  };
  crosswalk: {
    summary: typeof iso15924ScriptCodeCrosswalk.summary;
    rows: typeof iso15924ScriptCodeCrosswalk.rows;
  };
  diffPreview: {
    summary: typeof iso15924DiffPreview.summary;
    diffs: typeof iso15924DiffPreview.diffs;
  };
  blockers: {
    summary: typeof iso15924Blockers.summary;
    conflictPromotionPolicy: typeof iso15924Blockers.conflictPromotionPolicy;
    blockers: typeof iso15924Blockers.blockers;
  };
  evidence: {
    counts: typeof iso15924IngestionEvidence.counts;
    checks: typeof iso15924IngestionEvidence.checks;
    limitations: typeof iso15924IngestionEvidence.limitations;
  };
};

export type LipiCldrIngestionView = {
  ok: true;
  reviewState: LipiRegistryApiStatus;
  governedProductionGo: false;
  productionReady: false;
  phkdVerdict: "CONTROLLED_NO_GO";
  report: {
    ingestion: typeof cldrIngestionReport.ingestion;
    summary: typeof cldrIngestionReport.summary;
    officialSource: typeof cldrIngestionReport.officialSource;
  };
  crosswalk: {
    summary: typeof cldrScriptLocaleCrosswalk.summary;
    rows: typeof cldrScriptLocaleCrosswalk.rows;
    unmatchedCldrScripts: typeof cldrScriptLocaleCrosswalk.unmatchedCldrScripts;
  };
  diffPreview: {
    summary: typeof cldrDiffPreview.summary;
    diffs: typeof cldrDiffPreview.diffs;
  };
  blockers: {
    summary: typeof cldrBlockers.summary;
    ambiguousRelationPolicy: typeof cldrBlockers.ambiguousRelationPolicy;
    blockers: typeof cldrBlockers.blockers;
  };
  evidence: {
    counts: typeof cldrIngestionEvidence.counts;
    checks: typeof cldrIngestionEvidence.checks;
    limitations: typeof cldrIngestionEvidence.limitations;
  };
};

export type LipiIcuIngestionView = {
  ok: true;
  reviewState: LipiRegistryApiStatus;
  governedProductionGo: false;
  productionReady: false;
  phkdVerdict: "CONTROLLED_NO_GO";
  report: {
    ingestion: typeof icuIngestionReport.ingestion;
    summary: typeof icuIngestionReport.summary;
    officialSource: typeof icuIngestionReport.officialSource;
  };
  crosswalk: {
    summary: typeof icuScriptMetadataCrosswalk.summary;
    rows: typeof icuScriptMetadataCrosswalk.rows;
    extraIcuCodesNotInUcdRegistry: typeof icuScriptMetadataCrosswalk.extraIcuCodesNotInUcdRegistry;
    icuAliasConstants: typeof icuScriptMetadataCrosswalk.icuAliasConstants;
  };
  diffPreview: {
    summary: typeof icuDiffPreview.summary;
    diffs: typeof icuDiffPreview.diffs;
  };
  blockers: {
    summary: typeof icuBlockers.summary;
    mismatchPromotionPolicy: typeof icuBlockers.mismatchPromotionPolicy;
    blockers: typeof icuBlockers.blockers;
  };
  evidence: {
    counts: typeof icuIngestionEvidence.counts;
    checks: typeof icuIngestionEvidence.checks;
    limitations: typeof icuIngestionEvidence.limitations;
  };
};

export type LipiPhase12To16GovernanceView = {
  ok: true;
  reviewState: LipiRegistryApiStatus;
  governedProductionGo: false;
  productionReady: false;
  phkdVerdict: "CONTROLLED_NO_GO";
  phase12: {
    report: {
      ingestion: typeof harfbuzzOpenTypeDryRunReport.ingestion;
      officialSources: typeof harfbuzzOpenTypeDryRunReport.officialSources;
      adapterRuns: typeof harfbuzzOpenTypeDryRunReport.adapterRuns;
      limitations: typeof harfbuzzOpenTypeDryRunReport.limitations;
    };
    diffPreview: {
      summary: typeof harfbuzzOpenTypeDiffPreview.summary;
      diffs: typeof harfbuzzOpenTypeDiffPreview.diffs;
    };
    blockers: {
      summary: typeof harfbuzzOpenTypeBlockers.summary;
      promotionPolicy: typeof harfbuzzOpenTypeBlockers.promotionPolicy;
      blockers: typeof harfbuzzOpenTypeBlockers.blockers;
    };
    evidence: {
      counts: typeof harfbuzzOpenTypeEvidence.counts;
      checks: typeof harfbuzzOpenTypeEvidence.checks;
      limitations: typeof harfbuzzOpenTypeEvidence.limitations;
    };
  };
  phase13: {
    audit: {
      summary: typeof conflictAuthorityAudit.summary;
      authorityOrder: typeof conflictAuthorityAudit.authorityOrder;
      conflictPolicy: typeof conflictAuthorityAudit.conflictPolicy;
      audits: typeof conflictAuthorityAudit.audits;
      blockingFindings: typeof conflictAuthorityAudit.blockingFindings;
    };
    evidence: {
      counts: typeof conflictAuthorityEvidence.counts;
      checks: typeof conflictAuthorityEvidence.checks;
      limitations: typeof conflictAuthorityEvidence.limitations;
    };
  };
  phase14: {
    proposals: {
      summary: typeof controlledEnrichmentProposals.summary;
      proposalPolicy: typeof controlledEnrichmentProposals.proposalPolicy;
      proposals: typeof controlledEnrichmentProposals.proposals;
    };
    evidence: {
      counts: typeof controlledEnrichmentEvidence.counts;
      checks: typeof controlledEnrichmentEvidence.checks;
      limitations: typeof controlledEnrichmentEvidence.limitations;
    };
  };
  phase15: {
    gateReview: {
      summary: typeof runtimeGateReview.summary;
      gatePolicy: typeof runtimeGateReview.gatePolicy;
      criteria: typeof runtimeGateReview.criteria;
      blockers: typeof runtimeGateReview.blockers;
    };
    evidence: {
      counts: typeof runtimeGateEvidence.counts;
      checks: typeof runtimeGateEvidence.checks;
      limitations: typeof runtimeGateEvidence.limitations;
    };
  };
  phase16: {
    evidenceIndex: {
      summary: typeof releaseCandidateEvidenceIndex.summary;
      artifacts: typeof releaseCandidateEvidenceIndex.artifacts;
      reproducibility: typeof releaseCandidateEvidenceIndex.reproducibility;
      releaseCandidateReadiness: typeof releaseCandidateEvidenceIndex.releaseCandidateReadiness;
    };
    evidenceBundle: {
      summary: typeof releaseCandidateEvidenceBundle.summary;
      artifactIndex: typeof releaseCandidateEvidenceBundle.artifactIndex;
      reproducibility: typeof releaseCandidateEvidenceBundle.reproducibility;
      releaseCandidateReadiness: typeof releaseCandidateEvidenceBundle.releaseCandidateReadiness;
      checks: typeof releaseCandidateEvidenceBundle.checks;
      limitations: typeof releaseCandidateEvidenceBundle.limitations;
    };
  };
};

export type LipiPhase17To19GovernanceView = {
  ok: true;
  reviewState: LipiRegistryApiStatus;
  governedProductionGo: false;
  productionReady: false;
  phkdVerdict: "CONTROLLED_NO_GO";
  phase17: {
    operatorRunbook: {
      summary: typeof operatorRunbook.summary;
      runSequence: typeof operatorRunbook.runSequence;
      operatingChecks: typeof operatorRunbook.operatingChecks;
      stopConditions: typeof operatorRunbook.stopConditions;
      escalation: typeof operatorRunbook.escalation;
      referencedEvidence: typeof operatorRunbook.referencedEvidence;
    };
    evidence: {
      counts: typeof operatorRunbookEvidence.counts;
      checks: typeof operatorRunbookEvidence.checks;
      limitations: typeof operatorRunbookEvidence.limitations;
    };
  };
  phase18: {
    externalReviewPackage: {
      summary: typeof externalReviewPackage.summary;
      reviewPackage: typeof externalReviewPackage.reviewPackage;
      reviewerQuestions: typeof externalReviewPackage.reviewerQuestions;
      nonClaims: typeof externalReviewPackage.nonClaims;
      runbookSummary: typeof externalReviewPackage.runbookSummary;
    };
    evidence: {
      counts: typeof externalReviewEvidence.counts;
      checks: typeof externalReviewEvidence.checks;
      limitations: typeof externalReviewEvidence.limitations;
    };
  };
  phase19: {
    productionGoGate: {
      summary: typeof productionGoApprovalGate.summary;
      requiredApproval: typeof productionGoApprovalGate.requiredApproval;
      gatePolicy: typeof productionGoApprovalGate.gatePolicy;
      blockers: typeof productionGoApprovalGate.blockers;
    };
    evidence: {
      counts: typeof productionGoApprovalEvidence.counts;
      checks: typeof productionGoApprovalEvidence.checks;
      limitations: typeof productionGoApprovalEvidence.limitations;
    };
  };
};

export type LipiPhase24To27GovernanceView = {
  ok: true;
  reviewState: LipiRegistryRuntimeActivationStatus;
  governedProductionGo: false;
  productionReady: false;
  phkdVerdict: LipiRegistryRuntimeActivationStatus;
  phase24: {
    crossBrowserValidation: {
      schema: typeof phase24CrossBrowserValidation.schema;
      status: typeof phase24CrossBrowserValidation.status;
      summary: typeof phase24CrossBrowserValidation.summary;
      targets: typeof phase24CrossBrowserValidation.targets;
      blockers: typeof phase24CrossBrowserValidation.blockers;
      checks: typeof phase24CrossBrowserValidation.checks;
    };
  };
  phase25: {
    crossPlatformValidation: {
      schema: typeof phase25CrossPlatformValidation.schema;
      status: typeof phase25CrossPlatformValidation.status;
      summary: typeof phase25CrossPlatformValidation.summary;
      platforms: typeof phase25CrossPlatformValidation.platforms;
      blockers: typeof phase25CrossPlatformValidation.blockers;
      checks: typeof phase25CrossPlatformValidation.checks;
    };
  };
  phase26: {
    externalReviewHumanApproval: {
      schema: typeof phase26ExternalReviewHumanApproval.schema;
      status: typeof phase26ExternalReviewHumanApproval.status;
      summary: typeof phase26ExternalReviewHumanApproval.summary;
      approvalArtifact: typeof phase26ExternalReviewHumanApproval.approvalArtifact;
      reviewPackage: typeof phase26ExternalReviewHumanApproval.reviewPackage;
      blockers: typeof phase26ExternalReviewHumanApproval.blockers;
      checks: typeof phase26ExternalReviewHumanApproval.checks;
    };
  };
  phase27: {
    productionGoDecision: {
      schema: typeof phase27ProductionGoDecision.schema;
      status: typeof phase27ProductionGoDecision.status;
      decision: typeof phase27ProductionGoDecision.decision;
      summary: typeof phase27ProductionGoDecision.summary;
      decisionPolicy: typeof phase27ProductionGoDecision.decisionPolicy;
      blockers: typeof phase27ProductionGoDecision.blockers;
      checks: typeof phase27ProductionGoDecision.checks;
    };
  };
};

export type LipiRegistryRuntimeActivationView = {
  ok: true;
  schema: typeof runtimeActivationEvidence.schema;
  reviewState: LipiRegistryRuntimeActivationStatus;
  registryRuntimeActive: typeof runtimeActivationEvidence.registryRuntimeActive;
  runtimeMode: typeof runtimeActivationEvidence.runtimeMode;
  readOnly: typeof runtimeActivationEvidence.readOnly;
  mutationAllowed: typeof runtimeActivationEvidence.mutationAllowed;
  productionReady: typeof runtimeActivationEvidence.productionReady;
  governedProductionGo: typeof runtimeActivationEvidence.governedProductionGo;
  productionGoApproved: typeof runtimeActivationEvidence.productionGoApproved;
  humanApprovalPresent: typeof runtimeActivationEvidence.humanApprovalPresent;
  runtimeEnabledRows: typeof runtimeActivationEvidence.runtimeEnabledRows;
  releaseCandidate: typeof runtimeActivationEvidence.releaseCandidate;
  enrichmentAutoApplyAllowed: typeof runtimeActivationEvidence.enrichmentAutoApplyAllowed;
  enrichmentProposalsApplied: typeof runtimeActivationEvidence.enrichmentProposalsApplied;
  registryMutations: typeof runtimeActivationEvidence.registryMutations;
  phkdVerdict: LipiRegistryRuntimeActivationStatus;
  sourcePolicy: typeof runtimeActivationEvidence.sourcePolicy;
  summary: typeof runtimeActivationEvidence.summary;
  runtimePolicy: typeof runtimeActivationEvidence.runtimePolicy;
  checks: typeof runtimeActivationEvidence.checks;
  blockers: typeof runtimeActivationEvidence.blockers;
  provenance: typeof runtimeActivationEvidence.provenance;
  outputHashes: typeof runtimeActivationEvidence.outputHashes;
};

export type LipiRenderingValidationView = {
  ok: true;
  schema: typeof renderingValidationEvidence.schema;
  reviewState: LipiRegistryRuntimeActivationStatus;
  governedProductionGo: false;
  productionReady: false;
  runtimeEnabledRows: typeof renderingValidationEvidence.runtimeEnabledRows;
  mutationAllowed: typeof renderingValidationEvidence.mutationAllowed;
  registryMutations: typeof renderingValidationEvidence.registryMutations;
  phkdVerdict: LipiRegistryRuntimeActivationStatus;
  corpus: {
    schema: typeof renderingCorpus.schema;
    summary: typeof renderingCorpus.summary;
    records: typeof renderingCorpus.records;
  };
  fontFixtures: {
    schema: typeof fontFixtureManifest.schema;
    summary: typeof fontFixtureManifest.summary;
    blockers: typeof fontFixtureManifest.blockers;
  };
  glyphBaselines: {
    schema: typeof glyphBaselineManifest.schema;
    summary: typeof glyphBaselineManifest.summary;
    blockers: typeof glyphBaselineManifest.blockers;
  };
  renderingEvidence: {
    counts: typeof renderingValidationEvidence.counts;
    targets: typeof renderingValidationEvidence.targets;
    checks: typeof renderingValidationEvidence.checks;
    blockers: typeof renderingValidationEvidence.blockers;
  };
  fontEvidence: {
    counts: typeof fontValidationEvidence.counts;
    checks: typeof fontValidationEvidence.checks;
    status: typeof fontValidationEvidence.status;
    blockers: typeof fontValidationEvidence.blockers;
  };
  shapingEvidence: {
    counts: typeof shapingValidationEvidence.counts;
    checks: typeof shapingValidationEvidence.checks;
    status: typeof shapingValidationEvidence.status;
    blockers: typeof shapingValidationEvidence.blockers;
  };
  engineEvidence: {
    harfbuzz: {
      schema: typeof harfbuzzRenderReport.schema;
      engine: typeof harfbuzzRenderReport.engine;
      counts: typeof harfbuzzRenderReport.counts;
      checks: typeof harfbuzzRenderReport.checks;
      results: typeof harfbuzzRenderReport.results;
    };
    browser: {
      schema: typeof browserRenderReport.schema;
      engine: typeof browserRenderReport.engine;
      counts: typeof browserRenderReport.counts;
      checks: typeof browserRenderReport.checks;
      results: typeof browserRenderReport.results;
    };
    openType: {
      schema: typeof openTypeRenderReport.schema;
      engine: typeof openTypeRenderReport.engine;
      counts: typeof openTypeRenderReport.counts;
      checks: typeof openTypeRenderReport.checks;
      results: typeof openTypeRenderReport.results;
    };
  };
  harfbuzzExecution: {
    environment: {
      schema: typeof harfbuzzEnvironment.schema;
      status: typeof harfbuzzEnvironment.status;
      harfbuzz: typeof harfbuzzEnvironment.harfbuzz;
      fontEnvironment: typeof harfbuzzEnvironment.fontEnvironment;
      checks: typeof harfbuzzEnvironment.checks;
    };
    availability: {
      schema: typeof harfbuzzAvailability.schema;
      status: typeof harfbuzzAvailability.status;
      executable: typeof harfbuzzAvailability.executable;
      smokeTest: typeof harfbuzzAvailability.smokeTest;
      checks: typeof harfbuzzAvailability.checks;
    };
    shapingEvidence: {
      schema: typeof harfbuzzShapingEvidence.schema;
      status: typeof harfbuzzShapingEvidence.status;
      counts: typeof harfbuzzShapingEvidence.counts;
      execution: typeof harfbuzzShapingEvidence.execution;
      checks: typeof harfbuzzShapingEvidence.checks;
      results: typeof harfbuzzShapingEvidence.results;
    };
  };
  glyphBaselineEvidence: {
    captures: {
      schema: typeof glyphBaselineCaptures.schema;
      status: typeof glyphBaselineCaptures.status;
      counts: typeof glyphBaselineCaptures.counts;
      browserAtlas: typeof glyphBaselineCaptures.browserAtlas;
      checks: typeof glyphBaselineCaptures.checks;
      captures: typeof glyphBaselineCaptures.captures;
    };
    renderDiff: {
      schema: typeof renderDiffReport.schema;
      status: typeof renderDiffReport.status;
      counts: typeof renderDiffReport.counts;
      checks: typeof renderDiffReport.checks;
      comparisons: typeof renderDiffReport.comparisons;
    };
    fontCoverage: {
      schema: typeof fontCoverageReport.schema;
      status: typeof fontCoverageReport.status;
      counts: typeof fontCoverageReport.counts;
      checks: typeof fontCoverageReport.checks;
      coverageByFont: typeof fontCoverageReport.coverageByFont;
    };
  };
};

export type LipiPhase3ScriptEnrichment = {
  crosswalk: (typeof unicodeCrosswalk.records)[number] | null;
  numeral: (typeof numeralRegistry.records)[number] | null;
  zero: (typeof zeroRegistry.records)[number] | null;
};

export const HKD_LIPI_REGISTRY_API_CONTRACTS = [
  {
    method: "GET",
    path: "/api/lipi-registry/scripts",
    handler: "listLipiRegistryScripts",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/scripts/{id}",
    handler: "getLipiRegistryScript",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/unicode/crosswalk",
    handler: "getLipiUnicodeCrosswalk",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/numerals-zero",
    handler: "getLipiNumeralZeroView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/phase3/family-graph",
    handler: "getLipiFamilyGraphView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/kbs/graph",
    handler: "getLipiKbsGraphView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/scripts/{id}/kbs",
    handler: "getLipiScriptKbsNeighborhood",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/export-center",
    handler: "getLipiRegistryAuditabilityView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/audit",
    handler: "getLipiRegistryAuditabilityView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/provenance",
    handler: "getLipiRegistryAuditabilityView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/validator",
    handler: "getLipiRegistryAuditabilityView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/diff",
    handler: "getLipiRegistryAuditabilityView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/federation/sources",
    handler: "getLipiEvidenceFederationView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/federation/lineage",
    handler: "getLipiEvidenceFederationView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/federation/conflicts",
    handler: "getLipiEvidenceFederationView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/federation/provenance-chains",
    handler: "getLipiEvidenceFederationView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/contracts",
    handler: "getLipiSourceIngestionContractsView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/policy",
    handler: "getLipiSourceIngestionContractsView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/trust-matrix",
    handler: "getLipiSourceIngestionContractsView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/conflict-rules",
    handler: "getLipiSourceIngestionContractsView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/dry-run",
    handler: "getLipiIngestionDryRunView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/field-diff-preview",
    handler: "getLipiIngestionDryRunView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/blockers",
    handler: "getLipiIngestionDryRunView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/iso15924/report",
    handler: "getLipiIso15924IngestionView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/iso15924/crosswalk",
    handler: "getLipiIso15924IngestionView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/iso15924/diff-preview",
    handler: "getLipiIso15924IngestionView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/iso15924/blockers",
    handler: "getLipiIso15924IngestionView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/cldr/report",
    handler: "getLipiCldrIngestionView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/cldr/crosswalk",
    handler: "getLipiCldrIngestionView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/cldr/diff-preview",
    handler: "getLipiCldrIngestionView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/cldr/blockers",
    handler: "getLipiCldrIngestionView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/icu/report",
    handler: "getLipiIcuIngestionView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/icu/crosswalk",
    handler: "getLipiIcuIngestionView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/icu/diff-preview",
    handler: "getLipiIcuIngestionView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/icu/blockers",
    handler: "getLipiIcuIngestionView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/harfbuzz-opentype/report",
    handler: "getLipiPhase12To16GovernanceView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/harfbuzz-opentype/diff-preview",
    handler: "getLipiPhase12To16GovernanceView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/ingestion/harfbuzz-opentype/blockers",
    handler: "getLipiPhase12To16GovernanceView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/conflict-authority-audit",
    handler: "getLipiPhase12To16GovernanceView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/controlled-enrichment/proposals",
    handler: "getLipiPhase12To16GovernanceView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/runtime-enablement/gate-review",
    handler: "getLipiPhase12To16GovernanceView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/runtime-activation",
    handler: "getLipiRegistryRuntimeActivationView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/rendering-validation",
    handler: "getLipiRenderingValidationView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/rendering-engine-evidence",
    handler: "getLipiRenderingValidationView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/harfbuzz/environment",
    handler: "getLipiRenderingValidationView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/harfbuzz/availability",
    handler: "getLipiRenderingValidationView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/harfbuzz/shaping-evidence",
    handler: "getLipiRenderingValidationView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/glyph-baselines/captures",
    handler: "getLipiRenderingValidationView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/render-diff-report",
    handler: "getLipiRenderingValidationView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/font-coverage-report",
    handler: "getLipiRenderingValidationView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/release-candidate/evidence-bundle",
    handler: "getLipiPhase12To16GovernanceView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/operator/runbook",
    handler: "getLipiPhase17To19GovernanceView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/external-review/package",
    handler: "getLipiPhase17To19GovernanceView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/production-go/approval-gate",
    handler: "getLipiPhase17To19GovernanceView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/cross-browser-validation",
    handler: "getLipiPhase24To27GovernanceView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/cross-platform-validation",
    handler: "getLipiPhase24To27GovernanceView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/external-review/human-approval",
    handler: "getLipiPhase24To27GovernanceView",
    status: "LOCAL_CONTRACT",
  },
  {
    method: "GET",
    path: "/api/lipi-registry/production-go/decision",
    handler: "getLipiPhase24To27GovernanceView",
    status: "LOCAL_CONTRACT",
  },
] as const;

const records = Object.freeze((seedDataset.records as HkdLipiScriptRegistryRecord[]).map((record) => Object.freeze(record)));
const kbsNodes: readonly LipiKbsNode[] = Object.freeze((kbsGraph.nodes as LipiKbsNode[]).map((node: LipiKbsNode) => Object.freeze(node)));
const kbsEdges: readonly LipiKbsEdge[] = Object.freeze((kbsGraph.edges as LipiKbsEdge[]).map((edge: LipiKbsEdge) => Object.freeze(edge)));
const kbsNodeById = new Map<string, LipiKbsNode>(kbsNodes.map((node) => [node.id, node]));

export function getLipiRegistryRecords(): readonly HkdLipiScriptRegistryRecord[] {
  return records;
}

export function getLipiRegistryStats(sourceRecords: readonly HkdLipiScriptRegistryRecord[] = records): LipiRegistryStats {
  return {
    total: sourceRecords.length,
    byClass: countBy(sourceRecords, (record) => record.registry_class),
    byUnicodeStatus: countBy(sourceRecords, (record) => record.unicode_status),
    byEvidenceStatus: countBy(sourceRecords, (record) => record.evidence_status),
    runtimeEnabled: sourceRecords.filter((record) => record.hkd_runtime_enabled).length,
    rowsWithUnicodeRanges: unicodeCrosswalk.summary.rowsWithRanges,
    rowsWithKnownZeroGlyph: zeroRegistry.summary.zeroGlyphScripts,
    rowsWithDigitInventory: numeralRegistry.summary.completeDigitSetScripts,
    kbsNodes: kbsGraph.summary.totalNodes,
    kbsEdges: kbsGraph.summary.totalEdges,
  };
}

export function listLipiRegistryScripts(query: LipiRegistryListQuery = {}): LipiRegistryListResponse {
  const words = normalizeWords(query.q ?? "");
  const limit = Math.max(1, Math.min(query.limit ?? 80, 426));
  const filtered = records.filter((record) => matchesQuery(record, words, query));
  const sorted = filtered.sort((a, b) => scoreRecord(b, words) - scoreRecord(a, words) || a.registry_index - b.registry_index);
  const resultRecords = sorted.slice(0, limit);

  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    total: filtered.length,
    returned: resultRecords.length,
    stats: getLipiRegistryStats(records),
    records: resultRecords,
  };
}

export function getLipiRegistryScript(id: string): LipiRegistryRecordResponse {
  const record = records.find((candidate) => candidate.id === id);
  if (!record) {
    return {
      ok: false,
      reviewState: "CONTROLLED_NO_GO",
      governedProductionGo: false,
      productionReady: false,
      error: "SCRIPT_NOT_FOUND",
      id,
    };
  }

  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    record,
    badges: getLipiEvidenceBadges(record),
    relatedRecords: records
      .filter((candidate) => candidate.id !== record.id && candidate.script_family === record.script_family)
      .slice(0, 8),
    apiLinks: HKD_LIPI_REGISTRY_API_CONTRACTS.map((contract) => ({
      label: `${contract.method} ${contract.path}`,
      path: contract.path.replace("{id}", record.id),
    })),
  };
}

export function getLipiUnicodeCrosswalk(): LipiUnicodeCrosswalkResponse {
  const rows = unicodeCrosswalk.records.map((record) => ({
    id: `unicode-${slug(record.unicodeScriptValue)}`,
    displayName: record.unicodeScriptValue.replace(/_/g, " "),
    unicodeScriptValue: record.unicodeScriptValue,
    unicodeScriptAlias: record.unicodeScriptAlias,
    iso15924: record.iso15924,
    unicodeBlocks: record.unicodeBlocks,
    unicodeRanges: record.unicodeRanges,
    scriptPropertyKind: record.scriptPropertyKind,
    evidenceStatus: "verified",
    fontSupportStatus: record.fontSupportMetadata.status,
    transliterationStatus: record.transliterationMetadata.status,
  }));

  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    total: rows.length,
    rows,
  };
}

export function getLipiNumeralZeroView(): LipiNumeralZeroView {
  const zeroByScript = new Map(zeroRegistry.records.map((entry) => [entry.scriptValue, entry]));
  const rows = numeralRegistry.records.map((record) => {
    const zero = zeroByScript.get(record.scriptValue);
    return {
      id: `unicode-${slug(record.scriptValue)}`,
      displayName: record.scriptValue.replace(/_/g, " "),
      zeroGlyph: zero?.zeroGlyph ?? record.zeroGlyph,
      zeroCodePoint: zero?.zeroCodePoint ?? record.zeroCodePoint,
      digits: record.digits_0_9,
      hasDecimalDigits: record.allValuesPresent,
      numeralSystemType: "decimal",
      evidenceStatus: "verified",
      sourceRefs: record.sourceRefs,
    };
  });
  const rowsWithKnownZeroGlyph = rows.filter((row) => row.zeroGlyph !== "UNKNOWN").length;
  const rowsWithDigitInventory = rows.filter((row) => row.digits.length === 10).length;
  const rowsWithDecimalDigitsTrue = rows.filter((row) => row.hasDecimalDigits === true).length;

  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    summary: {
      total: rows.length,
      rowsWithKnownZeroGlyph,
      rowsWithDigitInventory,
      rowsWithDecimalDigitsTrue,
      rowsStillUnknown: rows.length - new Set(rows.filter((row) => row.zeroGlyph !== "UNKNOWN" || row.digits.length > 0 || row.hasDecimalDigits === true).map((row) => row.id)).size,
    },
    rows,
  };
}

export function getLipiZeroRegistryView() {
  return {
    ok: true as const,
    reviewState: "CONTROLLED_NO_GO" as const,
    governedProductionGo: false as const,
    productionReady: false as const,
    summary: zeroRegistry.summary,
    records: zeroRegistry.records,
  };
}

export function getLipiFamilyGraphView(): LipiFamilyGraphView {
  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    summary: familyGraph.summary,
    scriptNodes: familyGraph.nodes.scripts,
    blockNodes: familyGraph.nodes.blocks,
    scriptBlockEdges: familyGraph.edges.scriptBlockEdges,
    genealogicalFamilyEdges: familyGraph.edges.genealogicalFamilyEdges,
    blockedGenealogicalFamilyRelationships: familyGraph.edges.blockedGenealogicalFamilyRelationships,
  };
}

export function getLipiKbsGraphView(): LipiKbsGraphView {
  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    phkdVerdict: "CONTROLLED_NO_GO",
    summary: kbsGraph.summary,
    nodes: kbsNodes,
    edges: kbsEdges,
  };
}

export function getLipiScriptKbsNeighborhood(scriptId: string): LipiKbsScriptNeighborhood | null {
  const record = records.find((candidate) => candidate.id === scriptId);
  if (!record) return null;
  const scriptNode = kbsNodeById.get(record.kbs_node_id) ?? null;
  const edges = kbsEdges.filter((edge: LipiKbsEdge) => edge.from === record.kbs_node_id || edge.to === record.kbs_node_id);
  const neighbors = edges
    .map((edge) => (edge.from === record.kbs_node_id ? edge.to : edge.from))
    .map((nodeId) => kbsNodeById.get(nodeId))
    .filter((node): node is LipiKbsNode => Boolean(node));

  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    phkdVerdict: "CONTROLLED_NO_GO",
    record,
    scriptNode,
    edges,
    neighbors,
    blockedFields: kbsGraph.summary.blockedFields,
    summary: {
      edgeCount: edges.length,
      neighborCount: neighbors.length,
      byEdgeType: countBy(edges, (edge) => edge.type),
    },
  };
}

export function getLipiRegistryAuditabilityView(): LipiRegistryAuditabilityView {
  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    phkdVerdict: "CONTROLLED_NO_GO",
    exportCenter: {
      artifactPaths: auditReport.artifactPaths,
      outputHashes: auditReport.outputHashes,
    },
    evidenceAudit: {
      schema: auditReport.schema,
      inputCounts: auditReport.inputCounts,
      checks: auditReport.checks,
      failures: auditReport.failures,
    },
    provenance: {
      schema: provenanceReport.schema,
      counts: provenanceReport.counts,
      evidenceSources: provenanceReport.evidenceSources,
      orphanEvidenceReferences: provenanceReport.orphanEvidenceReferences,
      nodesMissingProvenance: provenanceReport.nodesMissingProvenance,
      edgesMissingProvenance: provenanceReport.edgesMissingProvenance,
      nodesUnreachableFromProvenance: provenanceReport.nodesUnreachableFromProvenance,
    },
    validator: {
      graphSummary: kbsGraph.summary,
      checks: auditReport.checks,
      failures: auditReport.failures,
    },
    registryDiff: auditReport.registryDiff,
  };
}

export function getLipiEvidenceFederationView(): LipiEvidenceFederationView {
  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    phkdVerdict: "CONTROLLED_NO_GO",
    sourceRegistry: {
      summary: sourceRegistry.summary,
      sources: sourceRegistry.sources,
    },
    lineageGraph: {
      summary: evidenceLineageGraph.summary,
      nodes: evidenceLineageGraph.nodes,
      edges: evidenceLineageGraph.edges,
    },
    conflictDetector: {
      summary: sourceConflictDetector.summary,
      checks: sourceConflictDetector.checks,
      localComparisons: sourceConflictDetector.localComparisons,
      blockedComparisons: sourceConflictDetector.blockedComparisons,
      conflicts: sourceConflictDetector.conflicts,
    },
    provenanceChains: {
      summary: provenanceChainExplorer.summary,
      sourceChains: provenanceChainExplorer.sourceChains,
      scriptChains: provenanceChainExplorer.scriptChains,
    },
    evidence: {
      counts: federationEvidence.counts,
      checks: federationEvidence.checks,
      limitations: federationEvidence.limitations,
    },
  };
}

export function getLipiSourceIngestionContractsView(): LipiSourceIngestionContractsView {
  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    phkdVerdict: "CONTROLLED_NO_GO",
    adapterContracts: {
      summary: sourceAdapterContracts.summary,
      adapters: sourceAdapterContracts.adapters,
    },
    ingestionPolicy: {
      policyId: ingestionPolicy.policyId,
      adapterMode: ingestionPolicy.adapterMode,
      allowedAdapterFieldStatuses: ingestionPolicy.allowedAdapterFieldStatuses,
      allowedActions: ingestionPolicy.allowedActions,
      forbiddenActions: ingestionPolicy.forbiddenActions,
      fieldTransitionPolicy: ingestionPolicy.fieldTransitionPolicy,
      adapterSummary: ingestionPolicy.adapterSummary,
    },
    trustMatrix: {
      summary: sourceTrustMatrix.summary,
      rows: sourceTrustMatrix.rows,
    },
    conflictRules: {
      summary: conflictResolutionRules.summary,
      rules: conflictResolutionRules.rules,
    },
    evidence: {
      counts: ingestionContractsEvidence.counts,
      checks: ingestionContractsEvidence.checks,
      limitations: ingestionContractsEvidence.limitations,
    },
  };
}

export function getLipiIngestionDryRunView(): LipiIngestionDryRunView {
  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    phkdVerdict: "CONTROLLED_NO_GO",
    dryRunReport: {
      dryRun: ingestionDryRunReport.dryRun,
      policySnapshot: ingestionDryRunReport.policySnapshot,
      adapterRuns: ingestionDryRunReport.adapterRuns,
    },
    fieldDiffPreview: {
      summary: ingestionFieldDiffPreview.summary,
      previews: ingestionFieldDiffPreview.previews,
    },
    blockers: {
      summary: ingestionBlockers.summary,
      conflictPromotionPolicy: ingestionBlockers.conflictPromotionPolicy,
      blockers: ingestionBlockers.blockers,
    },
    evidence: {
      counts: dryRunIngestionEvidence.counts,
      checks: dryRunIngestionEvidence.checks,
      limitations: dryRunIngestionEvidence.limitations,
    },
  };
}

export function getLipiIso15924IngestionView(): LipiIso15924IngestionView {
  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    phkdVerdict: "CONTROLLED_NO_GO",
    report: {
      ingestion: iso15924IngestionReport.ingestion,
      summary: iso15924IngestionReport.summary,
      officialSource: iso15924IngestionReport.officialSource,
    },
    crosswalk: {
      summary: iso15924ScriptCodeCrosswalk.summary,
      rows: iso15924ScriptCodeCrosswalk.rows,
    },
    diffPreview: {
      summary: iso15924DiffPreview.summary,
      diffs: iso15924DiffPreview.diffs,
    },
    blockers: {
      summary: iso15924Blockers.summary,
      conflictPromotionPolicy: iso15924Blockers.conflictPromotionPolicy,
      blockers: iso15924Blockers.blockers,
    },
    evidence: {
      counts: iso15924IngestionEvidence.counts,
      checks: iso15924IngestionEvidence.checks,
      limitations: iso15924IngestionEvidence.limitations,
    },
  };
}

export function getLipiCldrIngestionView(): LipiCldrIngestionView {
  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    phkdVerdict: "CONTROLLED_NO_GO",
    report: {
      ingestion: cldrIngestionReport.ingestion,
      summary: cldrIngestionReport.summary,
      officialSource: cldrIngestionReport.officialSource,
    },
    crosswalk: {
      summary: cldrScriptLocaleCrosswalk.summary,
      rows: cldrScriptLocaleCrosswalk.rows,
      unmatchedCldrScripts: cldrScriptLocaleCrosswalk.unmatchedCldrScripts,
    },
    diffPreview: {
      summary: cldrDiffPreview.summary,
      diffs: cldrDiffPreview.diffs,
    },
    blockers: {
      summary: cldrBlockers.summary,
      ambiguousRelationPolicy: cldrBlockers.ambiguousRelationPolicy,
      blockers: cldrBlockers.blockers,
    },
    evidence: {
      counts: cldrIngestionEvidence.counts,
      checks: cldrIngestionEvidence.checks,
      limitations: cldrIngestionEvidence.limitations,
    },
  };
}

export function getLipiIcuIngestionView(): LipiIcuIngestionView {
  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    phkdVerdict: "CONTROLLED_NO_GO",
    report: {
      ingestion: icuIngestionReport.ingestion,
      summary: icuIngestionReport.summary,
      officialSource: icuIngestionReport.officialSource,
    },
    crosswalk: {
      summary: icuScriptMetadataCrosswalk.summary,
      rows: icuScriptMetadataCrosswalk.rows,
      extraIcuCodesNotInUcdRegistry: icuScriptMetadataCrosswalk.extraIcuCodesNotInUcdRegistry,
      icuAliasConstants: icuScriptMetadataCrosswalk.icuAliasConstants,
    },
    diffPreview: {
      summary: icuDiffPreview.summary,
      diffs: icuDiffPreview.diffs,
    },
    blockers: {
      summary: icuBlockers.summary,
      mismatchPromotionPolicy: icuBlockers.mismatchPromotionPolicy,
      blockers: icuBlockers.blockers,
    },
    evidence: {
      counts: icuIngestionEvidence.counts,
      checks: icuIngestionEvidence.checks,
      limitations: icuIngestionEvidence.limitations,
    },
  };
}

export function getLipiPhase12To16GovernanceView(): LipiPhase12To16GovernanceView {
  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    phkdVerdict: "CONTROLLED_NO_GO",
    phase12: {
      report: {
        ingestion: harfbuzzOpenTypeDryRunReport.ingestion,
        officialSources: harfbuzzOpenTypeDryRunReport.officialSources,
        adapterRuns: harfbuzzOpenTypeDryRunReport.adapterRuns,
        limitations: harfbuzzOpenTypeDryRunReport.limitations,
      },
      diffPreview: {
        summary: harfbuzzOpenTypeDiffPreview.summary,
        diffs: harfbuzzOpenTypeDiffPreview.diffs,
      },
      blockers: {
        summary: harfbuzzOpenTypeBlockers.summary,
        promotionPolicy: harfbuzzOpenTypeBlockers.promotionPolicy,
        blockers: harfbuzzOpenTypeBlockers.blockers,
      },
      evidence: {
        counts: harfbuzzOpenTypeEvidence.counts,
        checks: harfbuzzOpenTypeEvidence.checks,
        limitations: harfbuzzOpenTypeEvidence.limitations,
      },
    },
    phase13: {
      audit: {
        summary: conflictAuthorityAudit.summary,
        authorityOrder: conflictAuthorityAudit.authorityOrder,
        conflictPolicy: conflictAuthorityAudit.conflictPolicy,
        audits: conflictAuthorityAudit.audits,
        blockingFindings: conflictAuthorityAudit.blockingFindings,
      },
      evidence: {
        counts: conflictAuthorityEvidence.counts,
        checks: conflictAuthorityEvidence.checks,
        limitations: conflictAuthorityEvidence.limitations,
      },
    },
    phase14: {
      proposals: {
        summary: controlledEnrichmentProposals.summary,
        proposalPolicy: controlledEnrichmentProposals.proposalPolicy,
        proposals: controlledEnrichmentProposals.proposals,
      },
      evidence: {
        counts: controlledEnrichmentEvidence.counts,
        checks: controlledEnrichmentEvidence.checks,
        limitations: controlledEnrichmentEvidence.limitations,
      },
    },
    phase15: {
      gateReview: {
        summary: runtimeGateReview.summary,
        gatePolicy: runtimeGateReview.gatePolicy,
        criteria: runtimeGateReview.criteria,
        blockers: runtimeGateReview.blockers,
      },
      evidence: {
        counts: runtimeGateEvidence.counts,
        checks: runtimeGateEvidence.checks,
        limitations: runtimeGateEvidence.limitations,
      },
    },
    phase16: {
      evidenceIndex: {
        summary: releaseCandidateEvidenceIndex.summary,
        artifacts: releaseCandidateEvidenceIndex.artifacts,
        reproducibility: releaseCandidateEvidenceIndex.reproducibility,
        releaseCandidateReadiness: releaseCandidateEvidenceIndex.releaseCandidateReadiness,
      },
      evidenceBundle: {
        summary: releaseCandidateEvidenceBundle.summary,
        artifactIndex: releaseCandidateEvidenceBundle.artifactIndex,
        reproducibility: releaseCandidateEvidenceBundle.reproducibility,
        releaseCandidateReadiness: releaseCandidateEvidenceBundle.releaseCandidateReadiness,
        checks: releaseCandidateEvidenceBundle.checks,
        limitations: releaseCandidateEvidenceBundle.limitations,
      },
    },
  };
}

export function getLipiPhase17To19GovernanceView(): LipiPhase17To19GovernanceView {
  return {
    ok: true,
    reviewState: "CONTROLLED_NO_GO",
    governedProductionGo: false,
    productionReady: false,
    phkdVerdict: "CONTROLLED_NO_GO",
    phase17: {
      operatorRunbook: {
        summary: operatorRunbook.summary,
        runSequence: operatorRunbook.runSequence,
        operatingChecks: operatorRunbook.operatingChecks,
        stopConditions: operatorRunbook.stopConditions,
        escalation: operatorRunbook.escalation,
        referencedEvidence: operatorRunbook.referencedEvidence,
      },
      evidence: {
        counts: operatorRunbookEvidence.counts,
        checks: operatorRunbookEvidence.checks,
        limitations: operatorRunbookEvidence.limitations,
      },
    },
    phase18: {
      externalReviewPackage: {
        summary: externalReviewPackage.summary,
        reviewPackage: externalReviewPackage.reviewPackage,
        reviewerQuestions: externalReviewPackage.reviewerQuestions,
        nonClaims: externalReviewPackage.nonClaims,
        runbookSummary: externalReviewPackage.runbookSummary,
      },
      evidence: {
        counts: externalReviewEvidence.counts,
        checks: externalReviewEvidence.checks,
        limitations: externalReviewEvidence.limitations,
      },
    },
    phase19: {
      productionGoGate: {
        summary: productionGoApprovalGate.summary,
        requiredApproval: productionGoApprovalGate.requiredApproval,
        gatePolicy: productionGoApprovalGate.gatePolicy,
        blockers: productionGoApprovalGate.blockers,
      },
      evidence: {
        counts: productionGoApprovalEvidence.counts,
        checks: productionGoApprovalEvidence.checks,
        limitations: productionGoApprovalEvidence.limitations,
      },
    },
  };
}

export function getLipiPhase24To27GovernanceView(): LipiPhase24To27GovernanceView {
  return {
    ok: true,
    reviewState: phase27ProductionGoDecision.reviewState as LipiRegistryRuntimeActivationStatus,
    governedProductionGo: false,
    productionReady: false,
    phkdVerdict: phase27ProductionGoDecision.phkdVerdict as LipiRegistryRuntimeActivationStatus,
    phase24: {
      crossBrowserValidation: {
        schema: phase24CrossBrowserValidation.schema,
        status: phase24CrossBrowserValidation.status,
        summary: phase24CrossBrowserValidation.summary,
        targets: phase24CrossBrowserValidation.targets,
        blockers: phase24CrossBrowserValidation.blockers,
        checks: phase24CrossBrowserValidation.checks,
      },
    },
    phase25: {
      crossPlatformValidation: {
        schema: phase25CrossPlatformValidation.schema,
        status: phase25CrossPlatformValidation.status,
        summary: phase25CrossPlatformValidation.summary,
        platforms: phase25CrossPlatformValidation.platforms,
        blockers: phase25CrossPlatformValidation.blockers,
        checks: phase25CrossPlatformValidation.checks,
      },
    },
    phase26: {
      externalReviewHumanApproval: {
        schema: phase26ExternalReviewHumanApproval.schema,
        status: phase26ExternalReviewHumanApproval.status,
        summary: phase26ExternalReviewHumanApproval.summary,
        approvalArtifact: phase26ExternalReviewHumanApproval.approvalArtifact,
        reviewPackage: phase26ExternalReviewHumanApproval.reviewPackage,
        blockers: phase26ExternalReviewHumanApproval.blockers,
        checks: phase26ExternalReviewHumanApproval.checks,
      },
    },
    phase27: {
      productionGoDecision: {
        schema: phase27ProductionGoDecision.schema,
        status: phase27ProductionGoDecision.status,
        decision: phase27ProductionGoDecision.decision,
        summary: phase27ProductionGoDecision.summary,
        decisionPolicy: phase27ProductionGoDecision.decisionPolicy,
        blockers: phase27ProductionGoDecision.blockers,
        checks: phase27ProductionGoDecision.checks,
      },
    },
  };
}

export function getLipiPlatformAttestationView() {
  // Read-only PHKD host-attestation view. A platform is VERIFIED only when its
  // own captured metadata proves that platform; mismatches become CONFLICT.
  // Never promotes production, never enables runtime rows.
  const conflicts = platformAttestation.platforms.filter((p) => p.attestation === "CONFLICT");
  return {
    ok: true,
    schema: platformAttestation.schema,
    reviewState: platformAttestation.reviewState,
    phkdVerdict: platformAttestation.phkdVerdict,
    attestationPass: platformAttestation.attestationPass,
    productionGo: "NO_GO" as const,
    control: platformAttestation.control,
    counts: platformAttestation.counts,
    platforms: platformAttestation.platforms,
    blockers: platformAttestation.blockers,
    attestationSummary: {
      id: conflicts.length > 0 ? "platform-attestation-conflict" : "platform-attestation-current",
      severity: conflicts.length > 0 ? "CONFLICT" as const : "CONTROLLED_PREVIEW" as const,
      summary:
        conflicts.length > 0
          ? `${conflicts.length} platform claim(s) have mismatched host metadata and are fail-closed.`
          : "Current VERIFIED platform claims are host-attested; incomplete platforms remain blocked.",
    },
  };
}

export function getLipiRegistryRuntimeActivationView(): LipiRegistryRuntimeActivationView {
  return {
    ok: true,
    schema: runtimeActivationEvidence.schema,
    reviewState: runtimeActivationEvidence.reviewState as LipiRegistryRuntimeActivationStatus,
    registryRuntimeActive: runtimeActivationEvidence.registryRuntimeActive,
    runtimeMode: runtimeActivationEvidence.runtimeMode,
    readOnly: runtimeActivationEvidence.readOnly,
    mutationAllowed: runtimeActivationEvidence.mutationAllowed,
    productionReady: runtimeActivationEvidence.productionReady,
    governedProductionGo: runtimeActivationEvidence.governedProductionGo,
    productionGoApproved: runtimeActivationEvidence.productionGoApproved,
    humanApprovalPresent: runtimeActivationEvidence.humanApprovalPresent,
    runtimeEnabledRows: runtimeActivationEvidence.runtimeEnabledRows,
    releaseCandidate: runtimeActivationEvidence.releaseCandidate,
    enrichmentAutoApplyAllowed: runtimeActivationEvidence.enrichmentAutoApplyAllowed,
    enrichmentProposalsApplied: runtimeActivationEvidence.enrichmentProposalsApplied,
    registryMutations: runtimeActivationEvidence.registryMutations,
    phkdVerdict: runtimeActivationEvidence.phkdVerdict as LipiRegistryRuntimeActivationStatus,
    sourcePolicy: runtimeActivationEvidence.sourcePolicy,
    summary: runtimeActivationEvidence.summary,
    runtimePolicy: runtimeActivationEvidence.runtimePolicy,
    checks: runtimeActivationEvidence.checks,
    blockers: runtimeActivationEvidence.blockers,
    provenance: runtimeActivationEvidence.provenance,
    outputHashes: runtimeActivationEvidence.outputHashes,
  };
}

export function getLipiRenderingValidationView(): LipiRenderingValidationView {
  return {
    ok: true,
    schema: renderingValidationEvidence.schema,
    reviewState: renderingValidationEvidence.reviewState as LipiRegistryRuntimeActivationStatus,
    governedProductionGo: false,
    productionReady: false,
    runtimeEnabledRows: renderingValidationEvidence.runtimeEnabledRows,
    mutationAllowed: renderingValidationEvidence.mutationAllowed,
    registryMutations: renderingValidationEvidence.registryMutations,
    phkdVerdict: renderingValidationEvidence.phkdVerdict as LipiRegistryRuntimeActivationStatus,
    corpus: {
      schema: renderingCorpus.schema,
      summary: renderingCorpus.summary,
      records: renderingCorpus.records,
    },
    fontFixtures: {
      schema: fontFixtureManifest.schema,
      summary: fontFixtureManifest.summary,
      blockers: fontFixtureManifest.blockers,
    },
    glyphBaselines: {
      schema: glyphBaselineManifest.schema,
      summary: glyphBaselineManifest.summary,
      blockers: glyphBaselineManifest.blockers,
    },
    renderingEvidence: {
      counts: renderingValidationEvidence.counts,
      targets: renderingValidationEvidence.targets,
      checks: renderingValidationEvidence.checks,
      blockers: renderingValidationEvidence.blockers,
    },
    fontEvidence: {
      counts: fontValidationEvidence.counts,
      checks: fontValidationEvidence.checks,
      status: fontValidationEvidence.status,
      blockers: fontValidationEvidence.blockers,
    },
    shapingEvidence: {
      counts: shapingValidationEvidence.counts,
      checks: shapingValidationEvidence.checks,
      status: shapingValidationEvidence.status,
      blockers: shapingValidationEvidence.blockers,
    },
    engineEvidence: {
      harfbuzz: {
        schema: harfbuzzRenderReport.schema,
        engine: harfbuzzRenderReport.engine,
        counts: harfbuzzRenderReport.counts,
        checks: harfbuzzRenderReport.checks,
        results: harfbuzzRenderReport.results,
      },
      browser: {
        schema: browserRenderReport.schema,
        engine: browserRenderReport.engine,
        counts: browserRenderReport.counts,
        checks: browserRenderReport.checks,
        results: browserRenderReport.results,
      },
      openType: {
        schema: openTypeRenderReport.schema,
        engine: openTypeRenderReport.engine,
        counts: openTypeRenderReport.counts,
        checks: openTypeRenderReport.checks,
        results: openTypeRenderReport.results,
      },
    },
    harfbuzzExecution: {
      environment: {
        schema: harfbuzzEnvironment.schema,
        status: harfbuzzEnvironment.status,
        harfbuzz: harfbuzzEnvironment.harfbuzz,
        fontEnvironment: harfbuzzEnvironment.fontEnvironment,
        checks: harfbuzzEnvironment.checks,
      },
      availability: {
        schema: harfbuzzAvailability.schema,
        status: harfbuzzAvailability.status,
        executable: harfbuzzAvailability.executable,
        smokeTest: harfbuzzAvailability.smokeTest,
        checks: harfbuzzAvailability.checks,
      },
      shapingEvidence: {
        schema: harfbuzzShapingEvidence.schema,
        status: harfbuzzShapingEvidence.status,
        counts: harfbuzzShapingEvidence.counts,
        execution: harfbuzzShapingEvidence.execution,
        checks: harfbuzzShapingEvidence.checks,
        results: harfbuzzShapingEvidence.results,
      },
    },
    glyphBaselineEvidence: {
      captures: {
        schema: glyphBaselineCaptures.schema,
        status: glyphBaselineCaptures.status,
        counts: glyphBaselineCaptures.counts,
        browserAtlas: glyphBaselineCaptures.browserAtlas,
        checks: glyphBaselineCaptures.checks,
        captures: glyphBaselineCaptures.captures,
      },
      renderDiff: {
        schema: renderDiffReport.schema,
        status: renderDiffReport.status,
        counts: renderDiffReport.counts,
        checks: renderDiffReport.checks,
        comparisons: renderDiffReport.comparisons,
      },
      fontCoverage: {
        schema: fontCoverageReport.schema,
        status: fontCoverageReport.status,
        counts: fontCoverageReport.counts,
        checks: fontCoverageReport.checks,
        coverageByFont: fontCoverageReport.coverageByFont,
      },
    },
  };
}

export function getLipiPhase3ScriptEnrichment(record: HkdLipiScriptRegistryRecord): LipiPhase3ScriptEnrichment {
  const scriptValue = record.unicode_script_value;
  if (scriptValue === "UNKNOWN") {
    return { crosswalk: null, numeral: null, zero: null };
  }
  return {
    crosswalk: unicodeCrosswalk.records.find((entry) => entry.unicodeScriptValue === scriptValue) ?? null,
    numeral: numeralRegistry.records.find((entry) => entry.scriptValue === scriptValue) ?? null,
    zero: zeroRegistry.records.find((entry) => entry.scriptValue === scriptValue) ?? null,
  };
}

export function getLipiEvidenceBadges(record: HkdLipiScriptRegistryRecord): LipiRegistryBadge[] {
  return [
    { label: "Evidence", value: record.evidence_status, tone: badgeToneForEvidence(record.evidence_status) },
    { label: "Unicode", value: record.unicode_status, tone: record.unicode_status === "encoded" ? "verified" : record.unicode_status === "unencoded" ? "blocked" : "draft" },
    { label: "Runtime", value: record.hkd_runtime_enabled ? "ENABLED" : "DISABLED", tone: record.hkd_runtime_enabled ? "verified" : "blocked" },
    { label: "ISO 15924", value: record.iso15924, tone: record.iso15924 === "UNKNOWN" ? "unknown" : "verified" },
    { label: "Sources", value: `${record.source_refs.length}`, tone: record.source_refs.length > 0 ? "neutral" : "blocked" },
  ];
}

export function getLipiRegistrySourceSummary() {
  return {
    architectureSchema: architecture.schema,
    seedSchema: seedDataset.schema,
    phase3Schemas: {
      numeral: numeralRegistry.schema,
      zero: zeroRegistry.schema,
      family: familyGraph.schema,
      crosswalk: unicodeCrosswalk.schema,
      kbs: kbsGraph.schema,
      audit: auditReport.schema,
      provenance: provenanceReport.schema,
      federationSources: sourceRegistry.schema,
      federationLineage: evidenceLineageGraph.schema,
      federationConflicts: sourceConflictDetector.schema,
      federationChains: provenanceChainExplorer.schema,
      adapterContracts: sourceAdapterContracts.schema,
      ingestionPolicy: ingestionPolicy.schema,
      trustMatrix: sourceTrustMatrix.schema,
      conflictRules: conflictResolutionRules.schema,
      ingestionDryRun: ingestionDryRunReport.schema,
      fieldDiffPreview: ingestionFieldDiffPreview.schema,
      ingestionBlockers: ingestionBlockers.schema,
      iso15924Ingestion: iso15924IngestionReport.schema,
      iso15924Crosswalk: iso15924ScriptCodeCrosswalk.schema,
      iso15924DiffPreview: iso15924DiffPreview.schema,
      iso15924Blockers: iso15924Blockers.schema,
      cldrIngestion: cldrIngestionReport.schema,
      cldrCrosswalk: cldrScriptLocaleCrosswalk.schema,
      cldrDiffPreview: cldrDiffPreview.schema,
      cldrBlockers: cldrBlockers.schema,
      icuIngestion: icuIngestionReport.schema,
      icuCrosswalk: icuScriptMetadataCrosswalk.schema,
      icuDiffPreview: icuDiffPreview.schema,
      icuBlockers: icuBlockers.schema,
      harfbuzzOpenTypeIngestion: harfbuzzOpenTypeDryRunReport.schema,
      harfbuzzOpenTypeDiffPreview: harfbuzzOpenTypeDiffPreview.schema,
      harfbuzzOpenTypeBlockers: harfbuzzOpenTypeBlockers.schema,
      conflictAuthorityAudit: conflictAuthorityAudit.schema,
      controlledEnrichmentProposals: controlledEnrichmentProposals.schema,
      runtimeEnablementGateReview: runtimeGateReview.schema,
      releaseCandidateEvidenceIndex: releaseCandidateEvidenceIndex.schema,
      releaseCandidateEvidenceBundle: releaseCandidateEvidenceBundle.schema,
      operatorRunbook: operatorRunbook.schema,
      operatorRunbookEvidence: operatorRunbookEvidence.schema,
      externalReviewPackage: externalReviewPackage.schema,
      externalReviewEvidence: externalReviewEvidence.schema,
      productionGoApprovalGate: productionGoApprovalGate.schema,
      productionGoApprovalEvidence: productionGoApprovalEvidence.schema,
      runtimeActivationEvidence: runtimeActivationEvidence.schema,
      renderingCorpus: renderingCorpus.schema,
      fontFixtureManifest: fontFixtureManifest.schema,
      glyphBaselineManifest: glyphBaselineManifest.schema,
      renderingValidationEvidence: renderingValidationEvidence.schema,
      fontValidationEvidence: fontValidationEvidence.schema,
      shapingValidationEvidence: shapingValidationEvidence.schema,
      harfbuzzRenderReport: harfbuzzRenderReport.schema,
      browserRenderReport: browserRenderReport.schema,
      openTypeRenderReport: openTypeRenderReport.schema,
      harfbuzzEnvironment: harfbuzzEnvironment.schema,
      harfbuzzAvailability: harfbuzzAvailability.schema,
      harfbuzzShapingEvidence: harfbuzzShapingEvidence.schema,
      glyphBaselineCaptures: glyphBaselineCaptures.schema,
      renderDiffReport: renderDiffReport.schema,
      fontCoverageReport: fontCoverageReport.schema,
      phase24CrossBrowserValidation: phase24CrossBrowserValidation.schema,
      phase25CrossPlatformValidation: phase25CrossPlatformValidation.schema,
      phase26ExternalReviewHumanApproval: phase26ExternalReviewHumanApproval.schema,
      phase27ProductionGoDecision: phase27ProductionGoDecision.schema,
    },
    sourceRefs: seedDataset.sourceRefs,
    phase3SourcePolicy: "official_unicode_ucd_only",
    phase4SourcePolicy: "hkd_registry_seed_plus_phase3_ucd_artifacts_only",
    phase6SourcePolicy: "cross_reference_only_no_new_script_claims",
    phase7SourcePolicy: "adapter_contracts_only_no_ingestion_no_silent_enrichment",
    phase8SourcePolicy: "dry_run_only_no_registry_mutation_no_enrichment",
    phase9SourcePolicy: "iso15924_official_source_only_preview_no_registry_mutation",
    phase10SourcePolicy: "cldr_official_source_only_locale_script_metadata_no_registry_mutation",
    phase11SourcePolicy: "icu_official_uscript_source_only_script_metadata_no_registry_mutation",
    phase12SourcePolicy: "harfbuzz_opentype_dry_run_blocked_without_fixtures_no_registry_mutation",
    phase13SourcePolicy: "cross_source_conflict_authority_audit_no_auto_resolution",
    phase14SourcePolicy: "controlled_enrichment_proposal_only_no_auto_apply",
    phase15SourcePolicy: "runtime_enablement_gate_review_no_runtime_enablement",
    phase16SourcePolicy: "release_candidate_evidence_bundle_no_release_candidate_go",
    phase17SourcePolicy: "operator_runbook_docs_only_no_registry_mutation",
    phase18SourcePolicy: "external_review_package_pending_no_approval_claim",
    phase19SourcePolicy: "production_go_only_after_human_approval_and_zero_blockers",
    runtimeActivationSourcePolicy: runtimeActivationEvidence.sourcePolicy,
    phase20SourcePolicy: renderingValidationEvidence.sourcePolicy,
    phase21SourcePolicy: browserRenderReport.sourcePolicy,
    phase22SourcePolicy: harfbuzzShapingEvidence.sourcePolicy,
    phase23SourcePolicy: glyphBaselineCaptures.sourcePolicy,
    phase24SourcePolicy: phase24CrossBrowserValidation.sourcePolicy,
    phase25SourcePolicy: phase25CrossPlatformValidation.sourcePolicy,
    phase26SourcePolicy: phase26ExternalReviewHumanApproval.sourcePolicy,
    phase27SourcePolicy: phase27ProductionGoDecision.sourcePolicy,
    contracts: HKD_LIPI_REGISTRY_API_CONTRACTS,
    reviewState: "CONTROLLED_NO_GO" as const,
    governedProductionGo: false as const,
    productionReady: false as const,
  };
}

function matchesQuery(record: HkdLipiScriptRegistryRecord, words: string[], query: LipiRegistryListQuery): boolean {
  if (query.registryClass && query.registryClass !== "all" && record.registry_class !== query.registryClass) return false;
  if (query.unicodeStatus && query.unicodeStatus !== "all" && record.unicode_status !== query.unicodeStatus) return false;
  if (query.evidenceStatus && query.evidenceStatus !== "all" && record.evidence_status !== query.evidenceStatus) return false;
  if (query.scriptFamily && query.scriptFamily !== "all" && record.script_family !== query.scriptFamily) return false;
  if (words.length === 0) return true;
  const haystack = [
    record.id,
    record.display_name,
    record.native_name,
    record.registry_class,
    record.script_family,
    record.unicode_script_value,
    record.unicode_script_alias,
    record.iso15924,
    record.unicode_status,
    record.evidence_status,
    record.cultural_status,
    record.script_property_kind,
    record.region_primary,
    ...record.alternate_names,
    ...record.regions,
    ...record.languages,
    ...record.unicode_blocks,
    ...record.unicode_ranges,
    ...record.source_refs,
  ]
    .join(" ")
    .toLowerCase();
  return words.every((word) => haystack.includes(word));
}

function scoreRecord(record: HkdLipiScriptRegistryRecord, words: string[]): number {
  if (words.length === 0) {
    if (record.registry_class === "unicode") return 4;
    if (record.evidence_status === "verified") return 3;
    if (record.evidence_status === "unknown") return 1;
    return 2;
  }
  const title = record.display_name.toLowerCase();
  const id = record.id.toLowerCase();
  return words.reduce((score, word) => score + (title.includes(word) ? 8 : id.includes(word) ? 5 : record.unicode_blocks.some((block) => block.toLowerCase().includes(word)) ? 3 : 1), 0);
}

function normalizeWords(value: string): string[] {
  return value.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function countBy<T>(items: readonly T[], selectKey: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = selectKey(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function badgeToneForEvidence(evidenceStatus: string): LipiRegistryBadgeTone {
  if (evidenceStatus === "verified") return "verified";
  if (evidenceStatus === "disputed") return "blocked";
  if (evidenceStatus === "draft" || evidenceStatus === "scholarly") return "draft";
  if (evidenceStatus === "unknown") return "unknown";
  return "neutral";
}

function slug(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
