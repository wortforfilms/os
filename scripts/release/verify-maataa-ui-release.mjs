#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const packageRoot = join(root, "packages/maataa-ui");
const packageJsonPath = join(packageRoot, "package.json");
const indexPath = join(packageRoot, "src/index.ts");
const evidencePath = join(root, "release/evidence/maataa-ui-release.json");
const manifestPath = join(root, "release/evidence/maataa-ui-package-manifest.json");
const reportPath = join(root, "release/evidence/maataa-ui-release-verification.json");

export function verifyMaataaUiRelease() {
  const failures = [];
  const packageJson = existsSync(packageJsonPath) ? JSON.parse(readFileSync(packageJsonPath, "utf8")) : null;
  const evidence = existsSync(evidencePath) ? JSON.parse(readFileSync(evidencePath, "utf8")) : null;
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
  const indexSource = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "";

  if (!existsSync(packageRoot)) failures.push("packages/maataa-ui is missing");
  if (packageJson?.name !== "@maataa/maataa-ui") failures.push("package name must be @maataa/maataa-ui");
  if (!existsSync(evidencePath)) failures.push("maataa-ui release evidence is missing");
  if (!existsSync(manifestPath)) failures.push("maataa-ui package manifest evidence is missing");

  const requiredExports = manifest?.requiredExports ?? [];
  for (const name of requiredExports) {
    if (!hasExport(indexSource, name) && !hasRecursiveExport(indexSource, name)) {
      failures.push(`required export not reachable from src/index.ts: ${name}`);
    }
  }

  if (evidence?.productionReady !== false) failures.push("productionReady must remain false");
  if (evidence?.phkdVerdict !== "BLOCKED") failures.push("phkdVerdict must be BLOCKED");
  if (evidence?.finalStatus !== "GOVERNED_PRODUCTION_NO_GO") failures.push("finalStatus must be GOVERNED_PRODUCTION_NO_GO");
  if (!Array.isArray(evidence?.activeBlockers) || evidence.activeBlockers.length === 0) failures.push("active blockers are required");
  if (evidence?.noFakeHardwareAttestation !== true) failures.push("fake hardware attestation guard is missing");
  if (evidence?.noFakeOperatorQuorum !== true) failures.push("fake operator quorum guard is missing");
  if (evidence?.noFakeReleaseAuthority !== true) failures.push("fake release authority guard is missing");

  const report = {
    schema: "maataa.maataa-ui.release-verification.v1",
    package: "@maataa/maataa-ui",
    status: failures.length === 0 ? "PASS" : "BLOCKED",
    productionReady: false,
    finalStatus: "GOVERNED_PRODUCTION_NO_GO",
    failures,
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

function hasExport(source, name) {
  return new RegExp(`export\\s+(const|function|class|type|interface)\\s+${name}\\b`).test(source);
}

function hasRecursiveExport(indexSource, name) {
  const files = [
    "src/components/SovereignHeader.tsx",
    "src/components/SovereignFooter.tsx",
    "src/components/CinematicHomepage.tsx",
    "src/components/MobileRuntimeShell.tsx",
    "src/components/MobileCommandOverlay.tsx",
    "src/components/MobileRuntimeStatus.tsx",
    "src/components/AamJantaaInterface.tsx",
    "src/components/HonestStatusBadge.tsx",
    "src/components/OfflineRuntimeBanner.tsx",
    "src/components/RuntimeHealthPanel.tsx",
    "src/components/FeatureEntryCard.tsx",
    "src/components/EvidencePanel.tsx",
    "src/components/BlockedReasonView.tsx",
    "src/data/language-interface-matrix.ts",
    "src/data/launch-readiness.ts",
    "src/types/governance.ts",
    "src/types/runtime.ts",
    "src/types/aam-jantaa.ts",
  ];
  return files.some((file) => existsSync(join(packageRoot, file)) && hasExport(readFileSync(join(packageRoot, file), "utf8"), name));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = verifyMaataaUiRelease();
  console.log(`MAATAA_UI_RELEASE_VERIFY=${report.status}`);
  console.log(`PRODUCTION_READY=${report.productionReady}`);
  console.log(`FINAL_STATUS=${report.finalStatus}`);
  console.log(`FAILURES=${report.failures.length}`);
  for (const failure of report.failures) console.log(`- ${failure}`);
  if (report.status !== "PASS") process.exitCode = 1;
}
