import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";

const INPUTS = {
  seed: "data/hkd-lipi-script-registry-seed-426.json",
  runtimeActivation: "release/evidence/hkd-lipi-registry-runtime-activation.json",
  glyphBaselineCaptures: "release/evidence/hkd-lipi-glyph-baseline-captures.json",
  renderDiffReport: "release/evidence/hkd-lipi-render-diff-report.json",
  fontCoverageReport: "release/evidence/hkd-lipi-font-coverage-report.json",
  phase18ReviewPackage: "release/evidence/hkd-lipi-registry-phase18-external-review-package.json",
  phase19ProductionGate: "release/evidence/hkd-lipi-registry-phase19-production-go-gate.json",
};

const OUT = {
  phase24CrossBrowser: "release/evidence/hkd-lipi-registry-phase24-cross-browser-validation.json",
  phase25CrossPlatform: "release/evidence/hkd-lipi-registry-phase25-cross-platform-validation.json",
  phase26ReviewApproval: "release/evidence/hkd-lipi-registry-phase26-external-review-human-approval.json",
  phase27ProductionDecision: "release/evidence/hkd-lipi-registry-phase27-production-go-decision.json",
};

const HUMAN_APPROVAL_ARTIFACT = "release/evidence/hkd-lipi-production-go-human-approval.json";
const GENERATED_AT = "DETERMINISTIC_FROM_PHASE24_TO_PHASE27_INPUTS";
const GENERATED_BY = "scripts/generate-hkd-lipi-registry-phases24-27.mjs";
const REVIEW_STATE = "CONTROLLED_PREVIEW_NO_GO";
const PHKD_VERDICT = "CONTROLLED_PREVIEW_NO_GO";
const SOURCE_POLICY = "cross_browser_cross_platform_review_and_production_decision_no_registry_mutation_no_runtime_enablement";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(pathOrBuffer) {
  const input = Buffer.isBuffer(pathOrBuffer) ? pathOrBuffer : readFileSync(pathOrBuffer);
  return createHash("sha256").update(input).digest("hex");
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stableStringify(value));
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function trustedInputs(extra = []) {
  return [...Object.entries(INPUTS).map(([id, path]) => ({ id, path, sha256: sha256(path) })), ...extra].sort((a, b) =>
    a.path.localeCompare(b.path),
  );
}

function provenance(scope, sourceIds, trusted = Object.values(INPUTS), phkd = "FACTS_FROM_LOCAL_EXECUTION_OR_BLOCKED") {
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
    governedProductionGo: false,
    productionReady: false,
    runtimeEnabledRows: 0,
    runtimeEnabled: 0,
    mutationAllowed: false,
    registryMutations: 0,
    releaseCandidate: false,
    phkdVerdict: PHKD_VERDICT,
    sourcePolicy: SOURCE_POLICY,
    trustedInputs: trustedInputs(),
    provenance: provenance(schema, sourceIds),
    ...extra,
  };
}

function outputHashes(paths) {
  return paths.map((path) => {
    const artifact = readJson(path);
    return {
      path,
      sha256: sha256(Buffer.from(stableStringify({ ...artifact, outputHashes: [] }))),
    };
  }).sort((a, b) => a.path.localeCompare(b.path));
}

function runVersion(executable, args = ["--version"], timeout = 5000) {
  if (!executable || !existsSync(executable)) {
    return { available: false, executable: executable ?? "MISSING", status: null, stdout: "", stderr: "", errorCode: "MISSING" };
  }
  const run = spawnSync(executable, args, { encoding: "utf8", timeout });
  return {
    available: run.status === 0,
    executable,
    status: run.status,
    signal: run.signal,
    stdout: run.stdout.trim(),
    stderr: run.stderr.trim(),
    errorCode: run.error?.code ?? null,
  };
}

function commandOutput(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8" }).trim();
  } catch {
    return "UNKNOWN";
  }
}

function browserTarget(id, label, executable, options = {}) {
  const version = options.skipVersionProbe
    ? { available: false, executable: executable ?? "MISSING", status: null, stdout: "", stderr: "", errorCode: "SKIPPED" }
    : runVersion(executable, options.versionArgs ?? ["--version"], options.timeout ?? 5000);
  return {
    id,
    label,
    executable: executable ?? "MISSING",
    installed: Boolean(executable && existsSync(executable)),
    versionStatus: version.available ? "VERIFIED" : executable && existsSync(executable) ? "BLOCKED" : "MISSING",
    versionOutput: version.stdout || version.stderr || "UNKNOWN",
    headlessCaptureStatus: options.headlessCaptureStatus,
    baselineEvidence: options.baselineEvidence ?? null,
    validationStatus: options.validationStatus,
    blocker: options.blocker ?? null,
    provenance: provenance("phase24_browser_target", [id, "hkd-lipi-phase23-glyph-baselines"]),
  };
}

function makePhase24(seed, glyphBaselineCaptures, renderDiffReport) {
  const chromeExecutable = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const firefoxExecutable = "/Applications/Firefox.app/Contents/MacOS/firefox";
  const safariExecutable = "/Applications/Safari.app/Contents/MacOS/Safari";
  const targets = [
    browserTarget("chrome", "Google Chrome", chromeExecutable, {
      validationStatus: glyphBaselineCaptures.counts.browserAtlasImages === 1 ? "VERIFIED" : "BLOCKED",
      headlessCaptureStatus: glyphBaselineCaptures.browserAtlas.capture.status,
      baselineEvidence: {
        atlasImagePath: glyphBaselineCaptures.browserAtlas.imagePath,
        atlasSha256: glyphBaselineCaptures.browserAtlas.sha256,
        capturedRows: glyphBaselineCaptures.browserAtlas.rowCount,
        renderDiffComparisons: renderDiffReport.counts.browserVsHarfBuzzComparisons,
      },
      blocker: null,
    }),
    browserTarget("firefox", "Mozilla Firefox", firefoxExecutable, {
      validationStatus: "BLOCKED",
      headlessCaptureStatus: "NOT_EXECUTED",
      blocker: {
        id: "phase24:blocker:firefox-not-available",
        status: "BLOCKED",
        severity: "HIGH",
        reason: "Firefox is not installed in /Applications and no Firefox render capture artifact exists.",
        requiredToUnblock: ["install Firefox", "run a source-backed Firefox baseline capture harness", "compare against Phase 23 baseline hashes"],
      },
    }),
    browserTarget("safari", "Safari", safariExecutable, {
      validationStatus: "BLOCKED",
      headlessCaptureStatus: "NOT_EXECUTED",
      skipVersionProbe: true,
      blocker: {
        id: "phase24:blocker:safari-headless-not-captured",
        status: "BLOCKED",
        severity: "HIGH",
        reason: "Safari is installed, but no WebKit/Safari baseline capture artifact exists in the evidence graph.",
        requiredToUnblock: ["configure a Safari/WebKit capture harness", "capture baseline atlas", "compare against Chrome and HarfBuzz evidence"],
      },
    }),
  ];
  const verifiedTargets = targets.filter((target) => target.validationStatus === "VERIFIED").length;
  const blockedTargets = targets.filter((target) => target.validationStatus === "BLOCKED").length;
  const blockers = targets.flatMap((target) => (target.blocker ? [{ ...target.blocker, provenance: target.provenance }] : []));
  return baseArtifact("hkd-lipi-registry-phase24-cross-browser-validation.v1", ["browser-canvas", "harfbuzz"], {
    status: blockedTargets === 0 ? "VERIFIED" : "BLOCKED",
    phase: 24,
    goal: "Cross-browser validation for Chrome, Firefox, and Safari without registry mutation.",
    summary: {
      registryRows: seed.records.length,
      targetBrowsers: targets.length,
      verifiedBrowsers: verifiedTargets,
      blockedBrowsers: blockedTargets,
      verifiedBaselineRows: glyphBaselineCaptures.counts.verifiedCaptureRows,
      browserAtlasImages: glyphBaselineCaptures.counts.browserAtlasImages,
      renderComparisons: renderDiffReport.counts.browserVsHarfBuzzComparisons,
      productionReady: false,
      runtimeEnabledRows: 0,
    },
    targets,
    blockers,
    checks: {
      chromeBaselineCaptured: targets.find((target) => target.id === "chrome")?.validationStatus === "VERIFIED",
      firefoxCaptured: false,
      safariCaptured: false,
      allTargetBrowsersVerified: false,
      noRegistryMutation: true,
      noRuntimeEnablement: true,
      productionReadyFalse: true,
    },
    outputHashes: [],
  });
}

function makePhase25(seed, glyphBaselineCaptures) {
  const platform = {
    id: "macos",
    label: "macOS",
    status: "VERIFIED",
    nodePlatform: process.platform,
    nodeArch: process.arch,
    hostname: os.hostname(),
    uname: commandOutput("uname", ["-a"]),
    swVers: commandOutput("sw_vers", []),
    verifiedBaselineRows: glyphBaselineCaptures.counts.verifiedCaptureRows,
    browserAtlasImages: glyphBaselineCaptures.counts.browserAtlasImages,
    provenance: provenance("phase25_platform_target", ["macos", "hkd-lipi-phase23-glyph-baselines"]),
  };
  const blockedPlatforms = [
    {
      id: "linux",
      label: "Linux",
      status: "BLOCKED",
      reason: "No Linux execution artifact exists for the Phase 23 rendering baseline.",
      requiredToUnblock: ["run Phase 23 generator on Linux", "attach platform report", "compare hashes and dimensions"],
      provenance: provenance("phase25_platform_target", ["linux"]),
    },
    {
      id: "windows",
      label: "Windows",
      status: "BLOCKED",
      reason: "No Windows execution artifact exists for the Phase 23 rendering baseline.",
      requiredToUnblock: ["run Phase 23 generator on Windows", "attach platform report", "compare hashes and dimensions"],
      provenance: provenance("phase25_platform_target", ["windows"]),
    },
  ];
  return baseArtifact("hkd-lipi-registry-phase25-cross-platform-validation.v1", ["macos", "hkd-lipi-phase23-glyph-baselines"], {
    status: "BLOCKED",
    phase: 25,
    goal: "Cross-platform validation for macOS, Linux, and Windows without registry mutation.",
    summary: {
      registryRows: seed.records.length,
      targetPlatforms: 3,
      verifiedPlatforms: 1,
      blockedPlatforms: 2,
      verifiedBaselineRows: glyphBaselineCaptures.counts.verifiedCaptureRows,
      productionReady: false,
      runtimeEnabledRows: 0,
    },
    platforms: [platform, ...blockedPlatforms],
    blockers: blockedPlatforms.map((target) => ({
      id: `phase25:blocker:${target.id}-evidence-missing`,
      status: "BLOCKED",
      severity: "HIGH",
      reason: target.reason,
      requiredToUnblock: target.requiredToUnblock,
      provenance: target.provenance,
    })),
    checks: {
      macosBaselineVerified: true,
      linuxBaselineVerified: false,
      windowsBaselineVerified: false,
      allPlatformsVerified: false,
      noRegistryMutation: true,
      noRuntimeEnablement: true,
      productionReadyFalse: true,
    },
    outputHashes: [],
  });
}

function approvalArtifactStatus() {
  if (!existsSync(HUMAN_APPROVAL_ARTIFACT)) {
    return {
      present: false,
      status: "MISSING",
      path: HUMAN_APPROVAL_ARTIFACT,
      sha256: "MISSING",
      validSignedApproval: false,
      reason: "Human approval artifact does not exist.",
    };
  }
  let parsed = null;
  try {
    parsed = readJson(HUMAN_APPROVAL_ARTIFACT);
  } catch {
    return {
      present: true,
      status: "INVALID",
      path: HUMAN_APPROVAL_ARTIFACT,
      sha256: sha256(HUMAN_APPROVAL_ARTIFACT),
      validSignedApproval: false,
      reason: "Human approval artifact is not valid JSON.",
    };
  }
  const valid =
    parsed.approved === true &&
    typeof parsed.approver_name === "string" &&
    parsed.approver_name !== "UNKNOWN" &&
    typeof parsed.signature === "string" &&
    parsed.signature.length > 0;
  return {
    present: true,
    status: valid ? "VERIFIED" : "BLOCKED",
    path: HUMAN_APPROVAL_ARTIFACT,
    sha256: sha256(HUMAN_APPROVAL_ARTIFACT),
    validSignedApproval: valid,
    reason: valid ? "Signed human approval artifact exists." : "Approval artifact exists but is not an approved signed approval.",
  };
}

function makePhase26(seed, phase18ReviewPackage, phase24, phase25) {
  const approval = approvalArtifactStatus();
  const reviewComplete = phase18ReviewPackage.reviewPackage?.reviewComplete === true;
  const reviewerSignoffs = phase18ReviewPackage.reviewPackage?.reviewerSignoffs ?? 0;
  const blockers = [
    {
      id: "phase26:blocker:external-review-pending",
      status: reviewComplete ? "RESOLVED" : "BLOCKED",
      severity: "HIGH",
      reason: reviewComplete ? "External review package is complete." : "External review package remains pending with no reviewer signoffs.",
      provenance: provenance("phase26_external_review_blocker", ["hkd-lipi-phase18-external-review-package"]),
    },
    {
      id: "phase26:blocker:human-approval-missing",
      status: approval.validSignedApproval ? "RESOLVED" : "BLOCKED",
      severity: "CRITICAL",
      reason: approval.reason,
      provenance: provenance("phase26_human_approval_blocker", ["human-approval-artifact"]),
    },
    {
      id: "phase26:blocker:cross-browser-incomplete",
      status: phase24.status === "VERIFIED" ? "RESOLVED" : "BLOCKED",
      severity: "HIGH",
      reason: phase24.status === "VERIFIED" ? "Cross-browser validation is complete." : "Cross-browser validation is incomplete.",
      provenance: provenance("phase26_cross_browser_blocker", ["hkd-lipi-phase24-cross-browser-validation"]),
    },
    {
      id: "phase26:blocker:cross-platform-incomplete",
      status: phase25.status === "VERIFIED" ? "RESOLVED" : "BLOCKED",
      severity: "HIGH",
      reason: phase25.status === "VERIFIED" ? "Cross-platform validation is complete." : "Cross-platform validation is incomplete.",
      provenance: provenance("phase26_cross_platform_blocker", ["hkd-lipi-phase25-cross-platform-validation"]),
    },
  ];
  return baseArtifact("hkd-lipi-registry-phase26-external-review-human-approval.v1", ["hkd-lipi-phase18-external-review-package"], {
    status: "BLOCKED",
    phase: 26,
    goal: "External review and human approval gate without AI or automatic approval.",
    summary: {
      registryRows: seed.records.length,
      externalReviewComplete: reviewComplete,
      reviewerSignoffs,
      humanApprovalPresent: approval.present,
      validSignedHumanApproval: approval.validSignedApproval,
      activeBlockers: blockers.filter((blocker) => blocker.status === "BLOCKED").length,
      productionReady: false,
      runtimeEnabledRows: 0,
    },
    approvalArtifact: approval,
    reviewPackage: {
      status: phase18ReviewPackage.reviewPackage?.status ?? "UNKNOWN",
      reviewComplete,
      reviewerSignoffs,
      artifacts: phase18ReviewPackage.reviewPackage?.artifacts ?? [],
    },
    blockers,
    checks: {
      externalReviewComplete: reviewComplete,
      humanApprovalPresent: approval.present,
      validSignedHumanApproval: approval.validSignedApproval,
      noAiApproval: true,
      noAutoApproval: true,
      noRegistryMutation: true,
      noRuntimeEnablement: true,
      productionReadyFalse: true,
    },
    outputHashes: [],
  });
}

function makePhase27(seed, phase19ProductionGate, phase24, phase25, phase26) {
  const activeBlockers = [
    ...phase24.blockers,
    ...phase25.blockers,
    ...phase26.blockers.filter((blocker) => blocker.status === "BLOCKED"),
    ...(phase19ProductionGate.blockers ?? []),
  ].map((blocker, index) => ({
    id: blocker.id ?? `phase27:blocker:${index}`,
    status: blocker.status ?? "BLOCKED",
    severity: blocker.severity ?? "HIGH",
    reason: blocker.reason,
    provenance: blocker.provenance ?? provenance("phase27_inherited_blocker", ["hkd-lipi-production-go-gate"]),
  }));
  return baseArtifact("hkd-lipi-registry-phase27-production-go-decision.v1", ["hkd-lipi-phase19-production-go-gate"], {
    status: "PRODUCTION_GO_BLOCKED",
    phase: 27,
    decision: "NO_GO",
    goal: "Production GO decision after cross-browser, cross-platform, external review, and human approval gates.",
    summary: {
      registryRows: seed.records.length,
      productionGoApproved: false,
      productionReady: false,
      governedProductionGo: false,
      humanApprovalPresent: phase26.summary.humanApprovalPresent,
      validSignedHumanApproval: phase26.summary.validSignedHumanApproval,
      crossBrowserVerified: phase24.status === "VERIFIED",
      crossPlatformVerified: phase25.status === "VERIFIED",
      externalReviewComplete: phase26.summary.externalReviewComplete,
      activeProductionGoBlockers: activeBlockers.filter((blocker) => blocker.status !== "RESOLVED").length,
      runtimeEnabledRows: 0,
      releaseCandidate: false,
    },
    decisionPolicy: {
      rule: "PRODUCTION_GO_ONLY_AFTER_HUMAN_APPROVAL_EXTERNAL_REVIEW_CROSS_BROWSER_CROSS_PLATFORM_AND_ZERO_BLOCKERS",
      aiApprovalAllowed: false,
      autoApprovalAllowed: false,
      rowMutationAllowed: false,
      runtimeEnablementAllowed: false,
      releaseCandidateAllowed: false,
    },
    blockers: activeBlockers,
    checks: {
      productionGoApprovedFalse: true,
      productionReadyFalse: true,
      governedProductionGoFalse: true,
      runtimeEnabledRowsZero: true,
      releaseCandidateFalse: true,
      noRegistryMutation: true,
      noAutoApproval: true,
      humanApprovalRequired: true,
      activeBlockersPreventGo: activeBlockers.some((blocker) => blocker.status !== "RESOLVED"),
    },
    outputHashes: [],
  });
}

function main() {
  const seed = readJson(INPUTS.seed);
  const runtimeActivation = readJson(INPUTS.runtimeActivation);
  const glyphBaselineCaptures = readJson(INPUTS.glyphBaselineCaptures);
  const renderDiffReport = readJson(INPUTS.renderDiffReport);
  const phase18ReviewPackage = readJson(INPUTS.phase18ReviewPackage);
  const phase19ProductionGate = readJson(INPUTS.phase19ProductionGate);

  if (runtimeActivation.runtimeEnabledRows !== 0 || runtimeActivation.productionReady !== false) {
    throw new Error("Phase 24-27 generation refuses to run while runtime rows are enabled or production is ready.");
  }
  if (seed.records.some((record) => record.hkd_runtime_enabled === true)) {
    throw new Error("Phase 24-27 generation refuses to run against runtime-enabled rows.");
  }
  if (glyphBaselineCaptures.counts.verifiedCaptureRows !== glyphBaselineCaptures.counts.verifiedShapingRows) {
    throw new Error("Phase 24 requires Phase 23 baseline evidence for every verified shaping sample.");
  }

  const phase24 = makePhase24(seed, glyphBaselineCaptures, renderDiffReport);
  writeJson(OUT.phase24CrossBrowser, phase24);
  const phase25 = makePhase25(seed, glyphBaselineCaptures);
  writeJson(OUT.phase25CrossPlatform, phase25);
  const phase26 = makePhase26(seed, phase18ReviewPackage, phase24, phase25);
  writeJson(OUT.phase26ReviewApproval, phase26);
  const phase27 = makePhase27(seed, phase19ProductionGate, phase24, phase25, phase26);
  writeJson(OUT.phase27ProductionDecision, phase27);

  const hashes = outputHashes(Object.values(OUT));
  for (const path of Object.values(OUT)) {
    const artifact = readJson(path);
    artifact.outputHashes = hashes;
    writeJson(path, artifact);
  }

  console.log(
    JSON.stringify(
      {
        phase24: readJson(OUT.phase24CrossBrowser).status,
        phase25: readJson(OUT.phase25CrossPlatform).status,
        phase26: readJson(OUT.phase26ReviewApproval).status,
        phase27: readJson(OUT.phase27ProductionDecision).decision,
        productionReady: false,
        runtimeEnabledRows: 0,
        phkdVerdict: PHKD_VERDICT,
      },
      null,
      2,
    ),
  );
}

main();
