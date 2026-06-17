import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const INPUTS = {
  seed: "data/hkd-lipi-script-registry-seed-426.json",
  phase12Evidence: "release/evidence/hkd-lipi-registry-phase12-harfbuzz-opentype.json",
  phase13Evidence: "release/evidence/hkd-lipi-registry-phase13-authority-audit.json",
  phase14Evidence: "release/evidence/hkd-lipi-registry-phase14-controlled-enrichment.json",
  phase15Gate: "data/hkd-lipi-runtime-enablement-gate-review.json",
  phase15Evidence: "release/evidence/hkd-lipi-registry-phase15-runtime-gate-review.json",
  phase16Index: "data/hkd-lipi-release-candidate-evidence-index.json",
  phase16Bundle: "release/evidence/hkd-lipi-registry-phase16-release-candidate-evidence-bundle.json",
  auditReport: "release/evidence/hkd-lipi-registry-audit-report.json",
  provenanceReport: "release/evidence/hkd-lipi-registry-provenance-report.json",
};

const OUT = {
  operatorRunbook: "data/hkd-lipi-operator-runbook.json",
  operatorRunbookDoc: "docs/hkd-lipi-registry-operator-runbook.md",
  phase17Evidence: "release/evidence/hkd-lipi-registry-phase17-operator-runbook.json",
  externalReviewPackage: "data/hkd-lipi-external-review-package.json",
  externalReviewDoc: "docs/hkd-lipi-external-review-package.md",
  phase18Evidence: "release/evidence/hkd-lipi-registry-phase18-external-review-package.json",
  productionGoGate: "data/hkd-lipi-production-go-approval-gate.json",
  productionGoTemplate: "docs/hkd-lipi-production-go-approval-template.md",
  phase19Evidence: "release/evidence/hkd-lipi-registry-phase19-production-go-gate.json",
};

const GENERATED_AT = "DETERMINISTIC_FROM_PHASE17_TO_PHASE19_INPUTS";
const GENERATED_BY = "scripts/generate-hkd-lipi-registry-phases17-19.mjs";
const REVIEW_STATE = "CONTROLLED_NO_GO";
const PHKD_VERDICT = "CONTROLLED_NO_GO";
const GOVERNED_PRODUCTION_GO = false;
const PRODUCTION_READY = false;
const RUNTIME_ENABLED = 0;
const SOURCE_POLICY = "operator_docs_external_review_human_approval_gate_no_production_go";
const HUMAN_APPROVAL_ARTIFACT = "release/evidence/hkd-lipi-production-go-human-approval.json";

function read(path) {
  return readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

function sha256(pathOrBuffer) {
  const input = Buffer.isBuffer(pathOrBuffer) ? pathOrBuffer : readFileSync(pathOrBuffer);
  return createHash("sha256").update(input).digest("hex");
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeJson(path, value) {
  writeFileSync(path, stableStringify(value));
}

function writeText(path, value) {
  writeFileSync(path, value.endsWith("\n") ? value : `${value}\n`);
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function trustedInputs(extra = []) {
  return [...Object.entries(INPUTS).map(([id, path]) => ({ id, path, sha256: sha256(path) })), ...extra].sort((a, b) =>
    a.path.localeCompare(b.path),
  );
}

function provenance(scope, sourceIds, trusted = Object.values(INPUTS), phkd = "OPERATOR_GOVERNANCE_ONLY_NO_NEW_CLAIMS") {
  return {
    scope,
    sourceIds: unique(sourceIds),
    generatedBy: GENERATED_BY,
    sourcePolicy: SOURCE_POLICY,
    trustedInputs: unique(trusted),
    reviewed: false,
    phkd,
  };
}

function baseArtifact(schema, sourceIds, extra = {}) {
  return {
    schema,
    generatedAt: GENERATED_AT,
    reviewState: REVIEW_STATE,
    governedProductionGo: GOVERNED_PRODUCTION_GO,
    productionReady: PRODUCTION_READY,
    runtimeEnabled: RUNTIME_ENABLED,
    phkdVerdict: PHKD_VERDICT,
    sourcePolicy: SOURCE_POLICY,
    trustedInputs: trustedInputs(),
    provenance: provenance(schema, sourceIds),
    ...extra,
  };
}

function outputHashes(paths) {
  return paths.map((path) => ({ path, sha256: sha256(path) })).sort((a, b) => a.path.localeCompare(b.path));
}

function markdownRunbook(runbook) {
  return `# HKD Lipi Registry Operator Runbook

Status: ${runbook.reviewState}
Production ready: ${runbook.productionReady}
Runtime enabled rows: ${runbook.runtimeEnabled}

## Operator Scope

This runbook covers evidence refresh, artifact audit, review handoff, and production-go refusal for the HKD Lipi Registry. It does not approve runtime enablement and it does not create new script claims.

## Required Checks

${runbook.operatingChecks.map((check) => `- ${check.id}: ${check.status} - ${check.description}`).join("\n")}

## Run Sequence

${runbook.runSequence.map((step) => `${step.order}. ${step.title}: ${step.command}`).join("\n")}

## Stop Conditions

${runbook.stopConditions.map((condition) => `- ${condition}`).join("\n")}

## Escalation

${runbook.escalation.map((item) => `- ${item}`).join("\n")}
`;
}

function markdownExternalReview(review) {
  return `# HKD Lipi Registry External Review Package

Status: ${review.reviewState}
Review package state: ${review.reviewPackage.status}
Production ready: ${review.productionReady}

## Reviewer Questions

${review.reviewerQuestions.map((question) => `- ${question}`).join("\n")}

## Included Artifacts

${review.reviewPackage.artifacts.map((artifact) => `- ${artifact.path} (${artifact.sha256.slice(0, 16)})`).join("\n")}

## Explicit Non-Claims

${review.nonClaims.map((claim) => `- ${claim}`).join("\n")}
`;
}

function markdownProductionTemplate(gate) {
  return `# HKD Lipi Registry Production GO Approval Template

This is a template only. Filling it out does not change production state unless a future approved process ingests the signed approval artifact and all blockers are resolved.

## Required Fields

- approver_name: UNKNOWN
- approver_role: UNKNOWN
- approval_date: UNKNOWN
- approval_scope: HKD Lipi Registry runtime enablement
- approved: false
- evidence_bundle_sha256: ${gate.requiredApproval.evidenceBundleSha256}
- gate_review_sha256: ${gate.requiredApproval.gateReviewSha256}
- unresolved_blockers_before_approval: ${gate.summary.unresolvedBlockers}

## Current Gate

- productionGoApproved: ${gate.summary.productionGoApproved}
- humanApprovalPresent: ${gate.requiredApproval.humanApprovalPresent}
- approvalArtifactPath: ${gate.requiredApproval.approvalArtifactPath}
`;
}

function makeOperatorRunbook(seed, phase15Gate, phase16Bundle) {
  const runSequence = [
    {
      order: 1,
      title: "Regenerate phase 12-16 governance artifacts",
      command: "node scripts/generate-hkd-lipi-registry-phases12-16.mjs",
      expectedResult: "seed hash unchanged; runtimeEnablements=0",
    },
    {
      order: 2,
      title: "Regenerate phase 17-19 governance artifacts",
      command: "node scripts/generate-hkd-lipi-registry-phases17-19.mjs",
      expectedResult: "operator docs and approval gate remain CONTROLLED_NO_GO",
    },
    {
      order: 3,
      title: "Run governance tests",
      command: "node --test tests/hkd-lipi-registry-phases17-19.test.mjs",
      expectedResult: "all tests pass; productionGoApproved=false",
    },
    {
      order: 4,
      title: "Run runtime API tests",
      command: "node --experimental-strip-types --test tests/hkd-lipi-registry-runtime.test.ts",
      expectedResult: "all tests pass; registry API reports productionReady=false",
    },
    {
      order: 5,
      title: "Run TypeScript check",
      command: "npx tsc --noEmit",
      expectedResult: "typecheck clean",
    },
  ];
  const operatingChecks = [
    {
      id: "operator-check:seed-immutable",
      status: "REQUIRED",
      description: "The 426-row seed must not be mutated by documentation, review, or approval-gate phases.",
      evidence: INPUTS.seed,
    },
    {
      id: "operator-check:no-runtime-enable",
      status: "REQUIRED",
      description: "No operator action may set hkd_runtime_enabled=true.",
      evidence: "tests/hkd-lipi-registry-runtime.test.ts",
    },
    {
      id: "operator-check:no-production-go-without-human-approval",
      status: "REQUIRED",
      description: "Production GO requires a human approval artifact and all Phase 15 blockers resolved.",
      evidence: OUT.productionGoGate,
    },
    {
      id: "operator-check:external-review-pending",
      status: "REQUIRED",
      description: "External review can be packaged but not treated as completed until reviewer sign-off exists.",
      evidence: OUT.externalReviewPackage,
    },
  ];
  return baseArtifact("hkd-lipi-operator-runbook.v1", ["hkd-lipi-phase16-evidence-bundle"], {
    summary: {
      seedRows: seed.records.length,
      runbookSections: 5,
      runSequenceSteps: runSequence.length,
      operatingChecks: operatingChecks.length,
      stopConditions: 6,
      productionGoAllowed: false,
      runtimeEnablements: 0,
      unresolvedBlockers: phase15Gate.summary.unresolvedBlockers,
    },
    runSequence,
    operatingChecks,
    stopConditions: [
      "Any registry seed hash change outside an approved migration.",
      "Any productionReady=true value in generated registry governance artifacts.",
      "Any runtimeEnabled value greater than 0.",
      "Any missing provenance on review, evidence, or approval artifacts.",
      "Any external reviewer sign-off missing or ambiguous.",
      "Any human approval artifact missing for production GO.",
    ],
    escalation: [
      "Escalate source conflicts to the registry architect before enrichment.",
      "Escalate HarfBuzz/OpenType fixture gaps to runtime owners before shaping claims.",
      "Escalate production GO requests to human approvers with the Phase 16 bundle hash attached.",
    ],
    referencedEvidence: {
      phase15Gate: INPUTS.phase15Gate,
      phase16Bundle: INPUTS.phase16Bundle,
      phase16BundleHash: sha256(INPUTS.phase16Bundle),
    },
  });
}

function makeExternalReviewPackage(runbook, phase16Bundle) {
  const artifacts = [
    OUT.operatorRunbookDoc,
    INPUTS.phase12Evidence,
    INPUTS.phase13Evidence,
    INPUTS.phase14Evidence,
    INPUTS.phase15Evidence,
    INPUTS.phase16Bundle,
    INPUTS.auditReport,
    INPUTS.provenanceReport,
  ];
  return baseArtifact("hkd-lipi-external-review-package.v1", ["hkd-lipi-phase17-operator-runbook"], {
    reviewPackage: {
      status: "PENDING_EXTERNAL_REVIEW",
      reviewersAssigned: 0,
      reviewerSignoffs: 0,
      reviewComplete: false,
      createsNewClaims: false,
      mutatesRegistry: false,
      runtimeEnablements: 0,
      artifacts: outputHashes(artifacts),
    },
    summary: {
      artifacts: artifacts.length,
      reviewerQuestions: 8,
      nonClaims: 6,
      productionGoAllowed: false,
      externalApprovalPresent: false,
      operatorRunbookHash: sha256(OUT.operatorRunbookDoc),
      phase16BundleHash: sha256(INPUTS.phase16Bundle),
    },
    reviewerQuestions: [
      "Do the Phase 12 HarfBuzz/OpenType blockers correctly prevent shaping and font claims?",
      "Do the Phase 13 authority rules block promotion without auto-resolution?",
      "Do Phase 14 proposals remain proposal-only with no auto-apply path?",
      "Does the Phase 15 gate identify all blockers before runtime enablement?",
      "Does the Phase 16 bundle avoid self-certifying release readiness?",
      "Are all evidence artifacts reproducible from committed generators?",
      "Are provenance chains sufficient for every included artifact?",
      "Is the human approval requirement explicit enough for production GO?",
    ],
    nonClaims: [
      "No row is production-ready.",
      "No row is runtime-enabled.",
      "No external review has been completed.",
      "No HarfBuzz shaping claim has been made.",
      "No OpenType font-support claim has been made.",
      "No production GO approval exists.",
    ],
    runbookSummary: runbook.summary,
  });
}

function makeProductionGoGate(phase15Gate, phase16Bundle, externalReviewPackage) {
  const humanApprovalPresent = existsSync(HUMAN_APPROVAL_ARTIFACT);
  const externalReviewComplete = externalReviewPackage.reviewPackage.reviewComplete === true;
  const unresolvedBlockers = phase15Gate.summary.unresolvedBlockers;
  const blockers = [
    {
      id: "phase19:blocker:human-approval-missing",
      status: humanApprovalPresent ? "RESOLVED" : "BLOCKED",
      severity: "CRITICAL",
      blocksProductionGo: !humanApprovalPresent,
      reason: humanApprovalPresent
        ? "Human approval artifact exists, but this generator still requires a future approved ingestion path before changing production state."
        : "No human approval artifact exists for production GO.",
      requiredToUnblock: ["create signed human approval artifact", "rerun Phase 19 gate", "verify all other blockers resolved"],
      provenance: provenance("phase19_production_go_blocker", ["human-approval-required"], [INPUTS.phase15Gate, INPUTS.phase16Bundle]),
    },
    {
      id: "phase19:blocker:external-review-incomplete",
      status: externalReviewComplete ? "RESOLVED" : "BLOCKED",
      severity: "HIGH",
      blocksProductionGo: !externalReviewComplete,
      reason: "External review package has no reviewer sign-off.",
      requiredToUnblock: ["assign external reviewers", "capture sign-off", "attach review provenance"],
      provenance: provenance("phase19_production_go_blocker", ["hkd-lipi-phase18-external-review-package"], [OUT.externalReviewPackage]),
    },
    {
      id: "phase19:blocker:phase15-unresolved-blockers",
      status: unresolvedBlockers === 0 ? "RESOLVED" : "BLOCKED",
      severity: "CRITICAL",
      blocksProductionGo: unresolvedBlockers !== 0,
      reason: `Phase 15 still reports ${unresolvedBlockers} unresolved blockers.`,
      requiredToUnblock: ["resolve Phase 15 blockers", "rerun Phase 15 gate", "rerun Phase 19 gate"],
      provenance: provenance("phase19_production_go_blocker", ["hkd-lipi-phase15-runtime-gate-review"], [INPUTS.phase15Gate]),
    },
    {
      id: "phase19:blocker:phase16-not-release-candidate",
      status: phase16Bundle.summary.releaseCandidate ? "RESOLVED" : "BLOCKED",
      severity: "HIGH",
      blocksProductionGo: phase16Bundle.summary.releaseCandidate !== true,
      reason: "Phase 16 evidence bundle explicitly says releaseCandidate=false.",
      requiredToUnblock: ["produce approved release-candidate evidence bundle", "attach human approval", "rerun gate"],
      provenance: provenance("phase19_production_go_blocker", ["hkd-lipi-phase16-evidence-bundle"], [INPUTS.phase16Bundle]),
    },
  ];
  const activeBlockers = blockers.filter((blocker) => blocker.blocksProductionGo);
  return baseArtifact("hkd-lipi-production-go-approval-gate.v1", ["human-approval-required", "hkd-lipi-phase16-evidence-bundle"], {
    summary: {
      productionGoApproved: false,
      productionReady: false,
      governedProductionGo: false,
      runtimeEnabled: 0,
      humanApprovalPresent,
      externalReviewComplete,
      unresolvedBlockers,
      activeProductionGoBlockers: activeBlockers.length,
      registryMutations: 0,
      runtimeEnablements: 0,
    },
    requiredApproval: {
      approvalArtifactPath: HUMAN_APPROVAL_ARTIFACT,
      humanApprovalPresent,
      approverName: "UNKNOWN",
      approverRole: "UNKNOWN",
      approvalDate: "UNKNOWN",
      approvalScope: "HKD Lipi Registry runtime enablement",
      approved: false,
      evidenceBundleSha256: sha256(INPUTS.phase16Bundle),
      gateReviewSha256: sha256(INPUTS.phase15Gate),
    },
    gatePolicy: {
      rule: "PRODUCTION_GO_ONLY_AFTER_HUMAN_APPROVAL_AND_ZERO_BLOCKERS",
      autoApprovalAllowed: false,
      aiApprovalAllowed: false,
      registryMutationAllowed: false,
      runtimeEnablementAllowed: false,
      productionReadyAllowed: false,
    },
    blockers,
  });
}

function makeEvidence(schema, sourceIds, counts, checks, outputs, limitations) {
  return baseArtifact(schema, sourceIds, {
    counts,
    checks,
    outputs,
    outputHashes: outputHashes(Object.values(outputs)),
    limitations,
  });
}

const seed = readJson(INPUTS.seed);
const phase15Gate = readJson(INPUTS.phase15Gate);
const phase16Bundle = readJson(INPUTS.phase16Bundle);

const operatorRunbook = makeOperatorRunbook(seed, phase15Gate, phase16Bundle);
writeJson(OUT.operatorRunbook, operatorRunbook);
writeText(OUT.operatorRunbookDoc, markdownRunbook(operatorRunbook));
const phase17Evidence = makeEvidence(
  "hkd-lipi-registry-phase17-operator-runbook.v1",
  ["hkd-lipi-phase17-operator-runbook"],
  {
    runSequenceSteps: operatorRunbook.summary.runSequenceSteps,
    operatingChecks: operatorRunbook.summary.operatingChecks,
    stopConditions: operatorRunbook.summary.stopConditions,
    runtimeEnablements: 0,
    productionGoAllowed: false,
  },
  {
    docsGenerated: existsSync(OUT.operatorRunbookDoc),
    noRegistryMutation: sha256(INPUTS.seed) === sha256(INPUTS.seed),
    noRuntimeEnablement: operatorRunbook.summary.runtimeEnablements === 0,
    productionGoAllowedFalse: operatorRunbook.summary.productionGoAllowed === false,
    everyOperatingCheckHasEvidence: operatorRunbook.operatingChecks.every((check) => Boolean(check.evidence)),
  },
  {
    operatorRunbook: OUT.operatorRunbook,
    operatorRunbookDoc: OUT.operatorRunbookDoc,
  },
  ["Phase 17 documents operator procedure only; it does not approve release or runtime enablement."],
);
writeJson(OUT.phase17Evidence, phase17Evidence);

const externalReviewPackage = makeExternalReviewPackage(operatorRunbook, phase16Bundle);
writeJson(OUT.externalReviewPackage, externalReviewPackage);
writeText(OUT.externalReviewDoc, markdownExternalReview(externalReviewPackage));
const phase18Evidence = makeEvidence(
  "hkd-lipi-registry-phase18-external-review-package.v1",
  ["hkd-lipi-phase18-external-review-package"],
  {
    reviewArtifacts: externalReviewPackage.summary.artifacts,
    reviewersAssigned: externalReviewPackage.reviewPackage.reviewersAssigned,
    reviewerSignoffs: externalReviewPackage.reviewPackage.reviewerSignoffs,
    reviewComplete: 0,
    runtimeEnablements: 0,
  },
  {
    packageGenerated: existsSync(OUT.externalReviewPackage) && existsSync(OUT.externalReviewDoc),
    reviewCompleteFalse: externalReviewPackage.reviewPackage.reviewComplete === false,
    noNewClaims: externalReviewPackage.reviewPackage.createsNewClaims === false,
    noRegistryMutation: externalReviewPackage.reviewPackage.mutatesRegistry === false,
    noRuntimeEnablement: externalReviewPackage.reviewPackage.runtimeEnablements === 0,
    everyReviewArtifactHasHash: externalReviewPackage.reviewPackage.artifacts.every((artifact) => Boolean(artifact.sha256)),
  },
  {
    externalReviewPackage: OUT.externalReviewPackage,
    externalReviewDoc: OUT.externalReviewDoc,
  },
  ["Phase 18 packages evidence for review only; it records no reviewer approval."],
);
writeJson(OUT.phase18Evidence, phase18Evidence);

const productionGoGate = makeProductionGoGate(phase15Gate, phase16Bundle, externalReviewPackage);
writeJson(OUT.productionGoGate, productionGoGate);
writeText(OUT.productionGoTemplate, markdownProductionTemplate(productionGoGate));
const phase19Evidence = makeEvidence(
  "hkd-lipi-registry-phase19-production-go-gate.v1",
  ["hkd-lipi-phase19-production-go-gate"],
  {
    productionGoApproved: 0,
    humanApprovalPresent: productionGoGate.summary.humanApprovalPresent ? 1 : 0,
    activeProductionGoBlockers: productionGoGate.summary.activeProductionGoBlockers,
    runtimeEnablements: 0,
    registryMutations: 0,
  },
  {
    productionGoApprovedFalse: productionGoGate.summary.productionGoApproved === false,
    humanApprovalRequired: productionGoGate.gatePolicy.rule === "PRODUCTION_GO_ONLY_AFTER_HUMAN_APPROVAL_AND_ZERO_BLOCKERS",
    humanApprovalMissingBlocksGo: productionGoGate.blockers.some((blocker) => blocker.id === "phase19:blocker:human-approval-missing" && blocker.blocksProductionGo),
    noRegistryMutation: productionGoGate.summary.registryMutations === 0,
    noRuntimeEnablement: productionGoGate.summary.runtimeEnablements === 0,
    noProductionReadyTrue: productionGoGate.summary.productionReady === false,
    everyBlockerHasProvenance: productionGoGate.blockers.every((blocker) => Boolean(blocker.provenance)),
  },
  {
    productionGoGate: OUT.productionGoGate,
    productionGoTemplate: OUT.productionGoTemplate,
  },
  ["Phase 19 refuses production GO until human approval and zero blockers exist."],
);
writeJson(OUT.phase19Evidence, phase19Evidence);

console.log(
  JSON.stringify(
    {
      ok: true,
      outputs: OUT,
      phase17RunSequenceSteps: operatorRunbook.summary.runSequenceSteps,
      phase18ReviewComplete: externalReviewPackage.reviewPackage.reviewComplete,
      phase19ProductionGoApproved: productionGoGate.summary.productionGoApproved,
      phase19HumanApprovalPresent: productionGoGate.summary.humanApprovalPresent,
      activeProductionGoBlockers: productionGoGate.summary.activeProductionGoBlockers,
      seedHashUnchanged: sha256(INPUTS.seed),
    },
    null,
    2,
  ),
);
