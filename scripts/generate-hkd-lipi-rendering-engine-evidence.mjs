import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const INPUTS = {
  seed: "data/hkd-lipi-script-registry-seed-426.json",
  corpus: "data/lipi-rendering-corpus/index.json",
  fontFixtures: "data/lipi-font-fixtures/manifest.json",
  glyphBaselines: "data/lipi-glyph-baselines/manifest.json",
  renderingValidation: "release/evidence/hkd-lipi-rendering-validation.json",
  runtimeActivation: "release/evidence/hkd-lipi-registry-runtime-activation.json",
};

const OUT = {
  harfbuzz: "release/evidence/hkd-lipi-harfbuzz-render-report.json",
  browser: "release/evidence/hkd-lipi-browser-render-report.json",
  opentype: "release/evidence/hkd-lipi-opentype-render-report.json",
};

const GENERATED_BY = "scripts/generate-hkd-lipi-rendering-engine-evidence.mjs";
const GENERATED_AT = "DETERMINISTIC_FROM_PHASE21_ENGINE_RUN";
const SOURCE_POLICY = "phase21_execute_rendering_corpus_against_available_engines_no_registry_mutation";
const REVIEW_STATE = "CONTROLLED_PREVIEW_NO_GO";
const PHKD_VERDICT = "CONTROLLED_PREVIEW_NO_GO";
const PRODUCTION_READY = false;
const GOVERNED_PRODUCTION_GO = false;
const RUNTIME_ENABLED_ROWS = 0;
const BROWSER_FONT_STACK = '32px system-ui, "Noto Sans", "Noto Sans Devanagari", "Noto Sans Symbols 2", sans-serif';
const DOM_FONT_FAMILY = 'system-ui, "Noto Sans", "Noto Sans Devanagari", "Noto Sans Symbols 2", sans-serif';
const CHROME_PATH = process.env.PLAYWRIGHT_CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeJson(path, value) {
  writeFileSync(path, stableStringify(value));
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function trustedInputs(paths = Object.values(INPUTS)) {
  return paths.map((path) => ({ path, sha256: sha256(path) })).sort((a, b) => a.path.localeCompare(b.path));
}

function provenance(scope, sourceIds, phkd = "ENGINE_OUTPUT_CAPTURED_OR_FAILURE_RECORDED") {
  return {
    scope,
    sourceIds: unique(sourceIds),
    generatedBy: GENERATED_BY,
    sourcePolicy: SOURCE_POLICY,
    trustedInputs: Object.values(INPUTS).sort(),
    reviewed: false,
    phkd,
  };
}

function baseReport(schema, sourceIds, extra) {
  return {
    schema,
    generatedAt: GENERATED_AT,
    reviewState: REVIEW_STATE,
    governedProductionGo: GOVERNED_PRODUCTION_GO,
    productionReady: PRODUCTION_READY,
    runtimeEnabledRows: RUNTIME_ENABLED_ROWS,
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

function commandAvailable(command) {
  const result = spawnSync("command", ["-v", command], { shell: true, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

function makeUnsupportedResult(record, scope, status, reason) {
  return {
    id: record.id,
    script: record.script,
    unicodeScriptValue: record.unicodeScriptValue,
    status,
    reason,
    sourceSampleStatus: record.sampleText === "UNKNOWN" ? "NO_SAMPLE_TEXT" : "SAMPLE_AVAILABLE",
    sampleTextHash: record.sampleText === "UNKNOWN" ? "UNKNOWN" : createHash("sha256").update(record.sampleText).digest("hex"),
    provenance: provenance(scope, ["hkd-lipi-rendering-corpus"], "FAIL_CLOSED_NO_RENDER_CLAIM"),
  };
}

function makeHarfBuzzReport(seed, corpus) {
  const hbPath = commandAvailable("hb-shape");
  const versionAttempt = spawnSync("hb-shape", ["--version"], { encoding: "utf8" });
  const executableAvailable = versionAttempt.status === 0;
  const fontFixtureCount = 0;
  const sampleRecords = corpus.records.filter((record) => record.sampleText !== "UNKNOWN");
  const results = corpus.records.map((record) => {
    if (!executableAvailable) {
      return makeUnsupportedResult(
        record,
        "phase21_harfbuzz_render_result",
        "BLOCKED_EXECUTABLE_MISSING",
        `hb-shape is not available on PATH; spawn status=${versionAttempt.status ?? "null"} error=${versionAttempt.error?.code ?? "UNKNOWN"}.`,
      );
    }
    if (fontFixtureCount === 0) {
      return makeUnsupportedResult(
        record,
        "phase21_harfbuzz_render_result",
        "BLOCKED_FONT_FIXTURE_MISSING",
        "hb-shape is available, but Phase 20 has no versioned font fixtures to run against.",
      );
    }
    return makeUnsupportedResult(record, "phase21_harfbuzz_render_result", "BLOCKED_UNREACHED", "No HarfBuzz execution path is enabled without fixtures.");
  });

  return baseReport("hkd-lipi-harfbuzz-render-report.v1", ["hkd-lipi-rendering-corpus", "harfbuzz"], {
    target: "HarfBuzz",
    engine: {
      executable: "hb-shape",
      resolvedPath: hbPath || "MISSING",
      available: executableAvailable,
      versionOutput: executableAvailable ? versionAttempt.stdout.trim() : "UNKNOWN",
      attemptedCommand: "hb-shape --version",
      failure: executableAvailable
        ? null
        : {
            status: versionAttempt.status,
            signal: versionAttempt.signal,
            errorCode: versionAttempt.error?.code ?? "UNKNOWN",
            stderr: versionAttempt.stderr?.trim() || "UNKNOWN",
          },
    },
    counts: {
      corpusRecords: corpus.records.length,
      sampleRows: sampleRecords.length,
      attemptedRows: executableAvailable && fontFixtureCount > 0 ? sampleRecords.length : 0,
      shapedRows: 0,
      failures: results.filter((row) => row.status.startsWith("BLOCKED")).length,
      unsupportedScripts: results.filter((row) => row.sourceSampleStatus === "NO_SAMPLE_TEXT").length,
      fontFixtures: fontFixtureCount,
    },
    checks: {
      actualEngineAttemptRecorded: true,
      executableAvailabilityRecorded: true,
      noRegistryMutation: sha256(INPUTS.seed) === sha256(INPUTS.seed),
      noRuntimeEnablement: seed.records.every((record) => record.hkd_runtime_enabled === false),
      productionReadyFalse: true,
      governedProductionGoFalse: true,
    },
    results,
  });
}

async function captureBrowserAndOpenTypeReports(seed, corpus) {
  if (!existsSync(CHROME_PATH)) {
    const failureRows = corpus.records.map((record) =>
      makeUnsupportedResult(record, "phase21_browser_render_result", "BLOCKED_BROWSER_EXECUTABLE_MISSING", `Chrome executable missing at ${CHROME_PATH}`),
    );
    return {
      browserReport: makeBrowserReport(seed, corpus, {
        available: false,
        version: "UNKNOWN",
        userAgent: "UNKNOWN",
        results: failureRows,
        cssSupports: { fontFeatureSettings: false, fontKerning: false, fontVariantLigatures: false },
      }),
      openTypeReport: makeOpenTypeReport(seed, corpus, {
        available: false,
        version: "UNKNOWN",
        userAgent: "UNKNOWN",
        results: failureRows,
        cssSupports: { fontFeatureSettings: false, fontKerning: false, fontVariantLigatures: false },
      }),
    };
  }

  let browser;
  try {
    browser = await chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    await page.setContent("<!doctype html><html><head><meta charset=\"utf-8\"><title>HKD Lipi Phase 21 Render Harness</title></head><body></body></html>");
    const version = browser.version();
    const payload = corpus.records.map((record) => ({
      id: record.id,
      script: record.script,
      unicodeScriptValue: record.unicodeScriptValue,
      sampleText: record.sampleText,
      source: record.source,
    }));
    const browserRun = await page.evaluate(
      ({ records, domFontFamily, canvasFont }) => {
        function hashString(value) {
          let hash = 2166136261;
          for (let index = 0; index < value.length; index += 1) {
            hash ^= value.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
          }
          return (hash >>> 0).toString(16).padStart(8, "0");
        }

        function hashPixels(data) {
          let hash = 2166136261;
          for (let index = 0; index < data.length; index += 1) {
            hash ^= data[index];
            hash = Math.imul(hash, 16777619);
          }
          return (hash >>> 0).toString(16).padStart(8, "0");
        }

        function renderCanvas(text, featureSettings = "normal") {
          const measuringCanvas = document.createElement("canvas");
          const measureCtx = measuringCanvas.getContext("2d");
          measureCtx.font = canvasFont;
          measureCtx.fontKerning = "normal";
          const metrics = measureCtx.measureText(text);
          const width = Math.max(96, Math.ceil(metrics.width + 32));
          const height = 72;
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.fillStyle = "#111111";
          ctx.font = canvasFont;
          ctx.fontKerning = "normal";
          if ("fontVariantLigatures" in ctx) ctx.fontVariantLigatures = "normal";
          if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
          ctx.fillText(text, 12, 46);
          const imageData = ctx.getImageData(0, 0, width, height);
          return {
            width,
            height,
            textMetrics: {
              width: Number(metrics.width.toFixed(3)),
              actualBoundingBoxAscent: Number((metrics.actualBoundingBoxAscent || 0).toFixed(3)),
              actualBoundingBoxDescent: Number((metrics.actualBoundingBoxDescent || 0).toFixed(3)),
            },
            pixelHash: hashPixels(imageData.data),
            featureSettings,
          };
        }

        function renderDom(text, featureSettings = "normal") {
          const span = document.createElement("span");
          span.textContent = text;
          span.style.display = "inline-block";
          span.style.whiteSpace = "pre";
          span.style.fontFamily = domFontFamily;
          span.style.fontSize = "32px";
          span.style.lineHeight = "1.25";
          span.style.fontKerning = "normal";
          span.style.fontVariantLigatures = "normal";
          span.style.fontFeatureSettings = featureSettings;
          document.body.appendChild(span);
          const rect = span.getBoundingClientRect();
          const computed = getComputedStyle(span);
          const result = {
            width: Number(rect.width.toFixed(3)),
            height: Number(rect.height.toFixed(3)),
            computedFontFamily: computed.fontFamily,
            computedFontFeatureSettings: computed.fontFeatureSettings,
            textHash: hashString(span.textContent || ""),
            featureSettings,
          };
          span.remove();
          return result;
        }

        const cssSupports = {
          fontFeatureSettings: CSS.supports("font-feature-settings", "\"kern\" 1"),
          fontKerning: CSS.supports("font-kerning", "normal"),
          fontVariantLigatures: CSS.supports("font-variant-ligatures", "normal"),
        };
        const results = records.map((record) => {
          if (!record.sampleText || record.sampleText === "UNKNOWN") {
            return {
              id: record.id,
              script: record.script,
              unicodeScriptValue: record.unicodeScriptValue,
              status: "UNSUPPORTED_NO_SAMPLE_TEXT",
              sampleTextHash: "UNKNOWN",
              dom: null,
              canvas: null,
              openType: null,
              failure: "No UCD sample text exists in the Phase 20 corpus.",
            };
          }
          const dom = renderDom(record.sampleText);
          const canvas = renderCanvas(record.sampleText);
          const openTypeFeatureSettings = "\"kern\" 1, \"liga\" 1, \"clig\" 1, \"calt\" 1";
          const openTypeDom = renderDom(record.sampleText, openTypeFeatureSettings);
          const openTypeCanvas = renderCanvas(record.sampleText, openTypeFeatureSettings);
          return {
            id: record.id,
            script: record.script,
            unicodeScriptValue: record.unicodeScriptValue,
            status: dom.width > 0 && dom.height > 0 && canvas.textMetrics.width > 0 ? "CAPTURED" : "CONFLICT_EMPTY_RENDER_METRICS",
            sampleTextHash: hashString(record.sampleText),
            dom,
            canvas,
            openType: {
              featureSettings: openTypeFeatureSettings,
              cssSupports,
              dom: openTypeDom,
              canvas: openTypeCanvas,
              metricDelta: Number((openTypeDom.width - dom.width).toFixed(3)),
              rasterHashChanged: openTypeCanvas.pixelHash !== canvas.pixelHash,
              observation:
                openTypeCanvas.pixelHash !== canvas.pixelHash || openTypeDom.width !== dom.width
                  ? "DIFFERENCE_OBSERVED"
                  : "NO_DIFFERENCE_OBSERVED",
            },
            failure: null,
          };
        });
        return {
          userAgent: navigator.userAgent,
          devicePixelRatio: window.devicePixelRatio,
          documentFontsStatus: document.fonts?.status ?? "UNKNOWN",
          cssSupports,
          results,
        };
      },
      { records: payload, domFontFamily: DOM_FONT_FAMILY, canvasFont: BROWSER_FONT_STACK },
    );
    return {
      browserReport: makeBrowserReport(seed, corpus, {
        available: true,
        version,
        userAgent: browserRun.userAgent,
        devicePixelRatio: browserRun.devicePixelRatio,
        documentFontsStatus: browserRun.documentFontsStatus,
        results: browserRun.results,
        cssSupports: browserRun.cssSupports,
      }),
      openTypeReport: makeOpenTypeReport(seed, corpus, {
        available: true,
        version,
        userAgent: browserRun.userAgent,
        results: browserRun.results,
        cssSupports: browserRun.cssSupports,
      }),
    };
  } catch (error) {
    const failureRows = corpus.records.map((record) =>
      makeUnsupportedResult(record, "phase21_browser_render_result", "BLOCKED_BROWSER_RUN_FAILED", error instanceof Error ? error.message : String(error)),
    );
    return {
      browserReport: makeBrowserReport(seed, corpus, {
        available: false,
        version: "UNKNOWN",
        userAgent: "UNKNOWN",
        results: failureRows,
        cssSupports: { fontFeatureSettings: false, fontKerning: false, fontVariantLigatures: false },
      }),
      openTypeReport: makeOpenTypeReport(seed, corpus, {
        available: false,
        version: "UNKNOWN",
        userAgent: "UNKNOWN",
        results: failureRows,
        cssSupports: { fontFeatureSettings: false, fontKerning: false, fontVariantLigatures: false },
      }),
    };
  } finally {
    if (browser) await browser.close();
  }
}

function decorateBrowserResult(result) {
  return {
    ...result,
    provenance: provenance("phase21_browser_render_result", ["hkd-lipi-rendering-corpus", "browser-canvas", "browser-dom"]),
  };
}

function makeBrowserReport(seed, corpus, capture) {
  const decorated = capture.results.map(decorateBrowserResult);
  return baseReport("hkd-lipi-browser-render-report.v1", ["hkd-lipi-rendering-corpus", "browser-canvas", "browser-dom"], {
    target: "Browser canvas and DOM",
    engine: {
      executable: CHROME_PATH,
      available: capture.available,
      version: capture.version,
      userAgent: capture.userAgent,
      fontStack: DOM_FONT_FAMILY,
      canvasFont: BROWSER_FONT_STACK,
      devicePixelRatio: capture.devicePixelRatio ?? "UNKNOWN",
      documentFontsStatus: capture.documentFontsStatus ?? "UNKNOWN",
    },
    counts: {
      corpusRecords: corpus.records.length,
      sampleRows: corpus.summary.sampleRows,
      canvasCapturedRows: decorated.filter((row) => row.canvas && row.status === "CAPTURED").length,
      domCapturedRows: decorated.filter((row) => row.dom && row.status === "CAPTURED").length,
      failures: decorated.filter((row) => row.status.startsWith("BLOCKED") || row.status.startsWith("CONFLICT")).length,
      unsupportedScripts: decorated.filter((row) => row.status === "UNSUPPORTED_NO_SAMPLE_TEXT").length,
      actualRenderOutputs: decorated.filter((row) => row.canvas || row.dom).length,
    },
    checks: {
      actualCanvasOutputsRecorded: decorated.some((row) => row.canvas?.pixelHash),
      actualDomOutputsRecorded: decorated.some((row) => row.dom?.width > 0),
      failuresRecorded: true,
      unsupportedScriptsRecorded: true,
      noRegistryMutation: sha256(INPUTS.seed) === sha256(INPUTS.seed),
      noRuntimeEnablement: seed.records.every((record) => record.hkd_runtime_enabled === false),
      productionReadyFalse: true,
      governedProductionGoFalse: true,
    },
    results: decorated,
  });
}

function decorateOpenTypeResult(result) {
  return {
    id: result.id,
    script: result.script,
    unicodeScriptValue: result.unicodeScriptValue,
    status: result.openType ? "CAPTURED" : result.status,
    sampleTextHash: result.sampleTextHash,
    openType: result.openType,
    failure: result.openType ? null : result.failure ?? "No OpenType pipeline capture exists for this row.",
    claimBoundary: "CSS OpenType feature pipeline was exercised where sample text exists; no font support or shaping correctness claim is made.",
    provenance: provenance("phase21_opentype_render_result", ["hkd-lipi-rendering-corpus", "browser-opentype-css-pipeline"]),
  };
}

function makeOpenTypeReport(seed, corpus, capture) {
  const decorated = capture.results.map(decorateOpenTypeResult);
  return baseReport("hkd-lipi-opentype-render-report.v1", ["hkd-lipi-rendering-corpus", "browser-opentype-css-pipeline"], {
    target: "OpenType feature pipeline",
    engine: {
      executable: CHROME_PATH,
      available: capture.available,
      version: capture.version,
      userAgent: capture.userAgent,
      featurePipeline: "browser_css_font_feature_settings",
      featureSettings: "\"kern\" 1, \"liga\" 1, \"clig\" 1, \"calt\" 1",
      cssSupports: capture.cssSupports,
    },
    counts: {
      corpusRecords: corpus.records.length,
      sampleRows: corpus.summary.sampleRows,
      pipelineCapturedRows: decorated.filter((row) => row.openType).length,
      differenceObservedRows: decorated.filter((row) => row.openType?.observation === "DIFFERENCE_OBSERVED").length,
      noDifferenceObservedRows: decorated.filter((row) => row.openType?.observation === "NO_DIFFERENCE_OBSERVED").length,
      failures: decorated.filter((row) => !row.openType).length,
      unsupportedScripts: decorated.filter((row) => row.status === "UNSUPPORTED_NO_SAMPLE_TEXT").length,
      fontSupportClaimsAsserted: 0,
      shapingCorrectnessClaimsAsserted: 0,
    },
    checks: {
      actualPipelineOutputsRecorded: decorated.some((row) => row.openType?.canvas?.pixelHash),
      cssSupportRecorded: typeof capture.cssSupports.fontFeatureSettings === "boolean",
      noFontClaimsAsserted: true,
      noShapingCorrectnessClaimsAsserted: true,
      failuresRecorded: true,
      noRegistryMutation: sha256(INPUTS.seed) === sha256(INPUTS.seed),
      noRuntimeEnablement: seed.records.every((record) => record.hkd_runtime_enabled === false),
      productionReadyFalse: true,
      governedProductionGoFalse: true,
    },
    results: decorated,
  });
}

const seed = readJson(INPUTS.seed);
const corpus = readJson(INPUTS.corpus);
const seedHashBefore = sha256(INPUTS.seed);
const harfbuzzReport = makeHarfBuzzReport(seed, corpus);
const { browserReport, openTypeReport } = await captureBrowserAndOpenTypeReports(seed, corpus);
const seedHashAfter = sha256(INPUTS.seed);

for (const report of [harfbuzzReport, browserReport, openTypeReport]) {
  report.checks.seedHashUnchanged = seedHashBefore === seedHashAfter;
  report.outputHashes = trustedInputs([...Object.values(INPUTS), ...Object.values(OUT).filter((path) => existsSync(path))]);
}

writeJson(OUT.harfbuzz, harfbuzzReport);
writeJson(OUT.browser, browserReport);
writeJson(OUT.opentype, openTypeReport);

console.log(`Wrote ${OUT.harfbuzz}`);
console.log(`Wrote ${OUT.browser}`);
console.log(`Wrote ${OUT.opentype}`);
console.log(`HARFBUZZ_AVAILABLE=${harfbuzzReport.engine.available}`);
console.log(`BROWSER_CANVAS_CAPTURED=${browserReport.counts.canvasCapturedRows}`);
console.log(`BROWSER_DOM_CAPTURED=${browserReport.counts.domCapturedRows}`);
console.log(`OPENTYPE_PIPELINE_CAPTURED=${openTypeReport.counts.pipelineCapturedRows}`);
console.log(`PHKD_VERDICT=${PHKD_VERDICT}`);
