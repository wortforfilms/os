import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { getLipiRegistryRecords, getLipiRenderingValidationView } from "../src/lipi-registry/api.ts";

const paths = {
  harfbuzz: "release/evidence/hkd-lipi-harfbuzz-render-report.json",
  browser: "release/evidence/hkd-lipi-browser-render-report.json",
  openType: "release/evidence/hkd-lipi-opentype-render-report.json",
};

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8"));
}

test("Phase 21 report artifacts exist and keep controlled-preview gates closed", () => {
  for (const path of Object.values(paths)) {
    assert.equal(existsSync(path), true, path);
    const report = readJson(path);
    assert.equal(report.reviewState, "CONTROLLED_PREVIEW_NO_GO");
    assert.equal(report.phkdVerdict, "CONTROLLED_PREVIEW_NO_GO");
    assert.equal(report.productionReady, false);
    assert.equal(report.governedProductionGo, false);
    assert.equal(report.runtimeEnabledRows, 0);
    assert.equal(report.registryMutations, 0);
    assert.equal(report.mutationAllowed, false);
    assert.equal(report.results.every((row: { provenance?: unknown }) => Boolean(row.provenance)), true);
  }
});

test("Phase 21 browser report records real DOM and canvas outputs", () => {
  const report = readJson(paths.browser);
  const captured = report.results.filter((row: { status: string }) => row.status === "CAPTURED");
  const unsupported = report.results.filter((row: { status: string }) => row.status === "UNSUPPORTED_NO_SAMPLE_TEXT");

  assert.equal(report.schema, "hkd-lipi-browser-render-report.v1");
  assert.equal(report.engine.available, true);
  assert.equal(report.counts.corpusRecords, 426);
  assert.equal(report.counts.sampleRows, 183);
  assert.equal(report.counts.canvasCapturedRows, 183);
  assert.equal(report.counts.domCapturedRows, 183);
  assert.equal(report.counts.actualRenderOutputs, 183);
  assert.equal(captured.length, 183);
  assert.equal(unsupported.length, 243);
  assert.equal(captured.every((row: { canvas?: { pixelHash?: string; textMetrics?: { width: number } }; dom?: { width: number; height: number } }) => Boolean(row.canvas?.pixelHash) && (row.canvas?.textMetrics?.width ?? 0) > 0 && (row.dom?.width ?? 0) > 0 && (row.dom?.height ?? 0) > 0), true);
  assert.equal(report.checks.actualCanvasOutputsRecorded, true);
  assert.equal(report.checks.actualDomOutputsRecorded, true);
});

test("Phase 21 OpenType report records browser feature pipeline outputs without font claims", () => {
  const report = readJson(paths.openType);
  const captured = report.results.filter((row: { status: string }) => row.status === "CAPTURED");

  assert.equal(report.schema, "hkd-lipi-opentype-render-report.v1");
  assert.equal(report.engine.available, true);
  assert.equal(typeof report.engine.cssSupports.fontFeatureSettings, "boolean");
  assert.equal(report.counts.pipelineCapturedRows, 183);
  assert.equal(captured.length, 183);
  assert.equal(report.counts.fontSupportClaimsAsserted, 0);
  assert.equal(report.counts.shapingCorrectnessClaimsAsserted, 0);
  assert.equal(report.checks.actualPipelineOutputsRecorded, true);
  assert.equal(report.checks.noFontClaimsAsserted, true);
  assert.equal(report.checks.noShapingCorrectnessClaimsAsserted, true);
  assert.equal(captured.every((row: { openType?: { canvas?: { pixelHash?: string }; cssSupports?: { fontFeatureSettings: boolean } } }) => Boolean(row.openType?.canvas?.pixelHash) && typeof row.openType?.cssSupports?.fontFeatureSettings === "boolean"), true);
});

test("Phase 21 HarfBuzz report records executable or fixture failure instead of fake shaping", () => {
  const report = readJson(paths.harfbuzz);

  assert.equal(report.schema, "hkd-lipi-harfbuzz-render-report.v1");
  assert.equal(report.counts.corpusRecords, 426);
  assert.equal(report.counts.sampleRows, 183);
  assert.equal(report.counts.shapedRows, 0);
  assert.equal(report.counts.fontFixtures, 0);
  assert.equal(report.checks.actualEngineAttemptRecorded, true);
  assert.equal(report.checks.executableAvailabilityRecorded, true);
  if (report.engine.available === false) {
    assert.equal(report.engine.resolvedPath, "MISSING");
    assert.ok(report.engine.failure);
    assert.equal(report.results.every((row: { status: string }) => row.status === "BLOCKED_EXECUTABLE_MISSING"), true);
  } else {
    assert.equal(report.results.every((row: { status: string }) => row.status === "BLOCKED_FONT_FIXTURE_MISSING"), true);
  }
});

test("Phase 21 API folds engine reports into rendering validation view", () => {
  const view = getLipiRenderingValidationView();

  assert.equal(view.engineEvidence.browser.counts.canvasCapturedRows, 183);
  assert.equal(view.engineEvidence.browser.counts.domCapturedRows, 183);
  assert.equal(view.engineEvidence.openType.counts.pipelineCapturedRows, 183);
  assert.equal(view.engineEvidence.harfbuzz.counts.shapedRows, 0);
  assert.equal(view.engineEvidence.openType.counts.fontSupportClaimsAsserted, 0);
  assert.equal(view.runtimeEnabledRows, 0);
  assert.equal(view.productionReady, false);
  assert.equal(view.governedProductionGo, false);
});

test("Phase 21 leaves registry rows runtime-disabled", () => {
  const records = getLipiRegistryRecords();

  assert.equal(records.length, 426);
  assert.equal(records.every((record) => record.hkd_runtime_enabled === false), true);
});
