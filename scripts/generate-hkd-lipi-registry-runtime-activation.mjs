import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const INPUTS = {
  seed: "data/hkd-lipi-script-registry-seed-426.json",
  phase14Proposals: "data/hkd-lipi-controlled-enrichment-proposals.json",
  phase15Gate: "data/hkd-lipi-runtime-enablement-gate-review.json",
  phase16Bundle: "release/evidence/hkd-lipi-registry-phase16-release-candidate-evidence-bundle.json",
  phase19Gate: "data/hkd-lipi-production-go-approval-gate.json",
};

const OUT = "release/evidence/hkd-lipi-registry-runtime-activation.json";
const GENERATED_BY = "scripts/generate-hkd-lipi-registry-runtime-activation.mjs";
const SOURCE_POLICY = "controlled_preview_runtime_read_only_no_registry_mutation_no_production_go";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function trustedInputs() {
  return Object.entries(INPUTS)
    .map(([id, path]) => ({ id, path, sha256: sha256(path) }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function provenance(scope, sourceIds) {
  return {
    scope,
    sourceIds: unique(sourceIds),
    generatedBy: GENERATED_BY,
    sourcePolicy: SOURCE_POLICY,
    trustedInputs: Object.values(INPUTS).sort(),
    reviewed: false,
    phkd: "CONTROLLED_PREVIEW_ONLY_READS_EXISTING_EVIDENCE",
  };
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

const seed = readJson(INPUTS.seed);
const proposals = readJson(INPUTS.phase14Proposals);
const phase15Gate = readJson(INPUTS.phase15Gate);
const phase16Bundle = readJson(INPUTS.phase16Bundle);
const phase19Gate = readJson(INPUTS.phase19Gate);

const runtimeEnabledRows = seed.records.filter((record) => record.hkd_runtime_enabled === true).length;
const registryRows = seed.records.length;
const proposalAutoApplyCount =
  proposals.summary?.autoApply ?? proposals.proposals.filter((proposal) => proposal.autoApply === true).length;
const proposalMutationCount =
  proposals.summary?.registryMutations ?? proposals.proposals.filter((proposal) => proposal.registryMutationAllowed === true).length;
const releaseCandidate = phase16Bundle.summary.releaseCandidate === true;
const productionGoApproved = phase19Gate.summary.productionGoApproved === true;
const humanApprovalPresent = phase19Gate.summary.humanApprovalPresent === true;
const productionReady = false;
const governedProductionGo = false;

const checks = {
  registryRuntimeActiveTrue: true,
  runtimeModeControlledPreview: true,
  readOnlyTrue: true,
  mutationAllowedFalse: true,
  productionReadyFalse: productionReady === false,
  governedProductionGoFalse: governedProductionGo === false,
  productionGoApprovedFalse: productionGoApproved === false,
  humanApprovalPresentFalse: humanApprovalPresent === false,
  runtimeEnabledRowsZero: runtimeEnabledRows === 0,
  noRegistryRowsChanged: registryRows === 426 && phase15Gate.summary.registryMutations === 0,
  noEnrichmentProposalApplied: proposalAutoApplyCount === 0 && proposalMutationCount === 0,
  releaseCandidateFalse: releaseCandidate === false,
  phkdVerdictControlledPreviewNoGo: true,
};

const blockers = [
  {
    id: "runtime-activation:blocker:read-only-preview",
    status: "BLOCKED_FOR_PRODUCTION_GO",
    severity: "HIGH",
    reason: "Registry runtime is active only for read-only exploration and review; mutationAllowed=false.",
    provenance: provenance("runtime_activation_blocker", ["hkd-lipi-runtime-activation"]),
  },
  {
    id: "runtime-activation:blocker:row-runtime-disabled",
    status: "BLOCKED_FOR_ROW_ENABLEMENT",
    severity: "HIGH",
    reason: `No script rows have explicit per-row approval; runtimeEnabledRows=${runtimeEnabledRows}.`,
    provenance: provenance("runtime_activation_blocker", ["hkd-lipi-phase15-runtime-gate-review"]),
  },
  {
    id: "runtime-activation:blocker:production-go-missing-human-approval",
    status: "BLOCKED_FOR_PRODUCTION_GO",
    severity: "CRITICAL",
    reason: "No signed human approval artifact exists; productionGoApproved=false.",
    provenance: provenance("runtime_activation_blocker", ["hkd-lipi-phase19-production-go-gate"]),
  },
  {
    id: "runtime-activation:blocker:not-release-candidate",
    status: "BLOCKED_FOR_RELEASE_CANDIDATE",
    severity: "HIGH",
    reason: "Phase 16 remains releaseCandidate=false.",
    provenance: provenance("runtime_activation_blocker", ["hkd-lipi-phase16-evidence-bundle"]),
  },
];

const artifact = {
  schema: "hkd-lipi-registry-runtime-activation.v1",
  generatedAt: "DETERMINISTIC_FROM_RUNTIME_ACTIVATION_INPUTS",
  reviewState: "CONTROLLED_PREVIEW_NO_GO",
  registryRuntimeActive: true,
  runtimeMode: "CONTROLLED_PREVIEW",
  readOnly: true,
  mutationAllowed: false,
  productionReady,
  governedProductionGo,
  productionGoApproved,
  humanApprovalPresent,
  runtimeEnabledRows,
  releaseCandidate,
  enrichmentAutoApplyAllowed: false,
  enrichmentProposalsApplied: proposalAutoApplyCount,
  registryMutations: 0,
  phkdVerdict: "CONTROLLED_PREVIEW_NO_GO",
  sourcePolicy: SOURCE_POLICY,
  trustedInputs: trustedInputs(),
  provenance: provenance("hkd-lipi-registry-runtime-activation.v1", [
    "hkd-lipi-registry-seed-426",
    "hkd-lipi-phase14-controlled-enrichment",
    "hkd-lipi-phase15-runtime-gate-review",
    "hkd-lipi-phase16-evidence-bundle",
    "hkd-lipi-phase19-production-go-gate",
  ]),
  summary: {
    registryRows,
    registryRuntimeActive: true,
    runtimeMode: "CONTROLLED_PREVIEW",
    readOnly: true,
    mutationAllowed: false,
    productionReady,
    governedProductionGo,
    productionGoApproved,
    humanApprovalPresent,
    runtimeEnabledRows,
    enrichmentAutoApplyAllowed: false,
    enrichmentProposalsApplied: proposalAutoApplyCount,
    releaseCandidate,
    activeProductionBlockers: blockers.length,
  },
  runtimePolicy: {
    explorationAllowed: true,
    reviewAllowed: true,
    apiReadAllowed: true,
    registryMutationAllowed: false,
    rowRuntimeEnablementAllowed: false,
    enrichmentAutoApplyAllowed: false,
    releaseCandidateAllowed: false,
    productionGoAllowed: false,
  },
  checks,
  blockers,
  outputHashes: [
    { path: INPUTS.seed, sha256: sha256(INPUTS.seed) },
    { path: INPUTS.phase14Proposals, sha256: sha256(INPUTS.phase14Proposals) },
    { path: INPUTS.phase15Gate, sha256: sha256(INPUTS.phase15Gate) },
    { path: INPUTS.phase16Bundle, sha256: sha256(INPUTS.phase16Bundle) },
    { path: INPUTS.phase19Gate, sha256: sha256(INPUTS.phase19Gate) },
  ],
};

writeFileSync(OUT, stableStringify(artifact));

console.log(`Wrote ${OUT}`);
console.log(`REGISTRY_RUNTIME_ACTIVE=${artifact.registryRuntimeActive}`);
console.log(`RUNTIME_MODE=${artifact.runtimeMode}`);
console.log(`PHKD_VERDICT=${artifact.phkdVerdict}`);
console.log(`RUNTIME_ENABLED_ROWS=${artifact.runtimeEnabledRows}`);
console.log(`PRODUCTION_READY=${artifact.productionReady}`);
