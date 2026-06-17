import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  playgroundRoutes,
  PLAYGROUND_FINAL_STATUS,
  PLAYGROUND_PRODUCTION_STATUS,
  themeLabAssetReviewRoutes,
  themeLabAssetSandboxImport,
} from "../src/playgrounds/data.ts";
import { buildUnifiedSearchIndex, isNavigableSearchResult, searchUnifiedIndex } from "../src/search/index.ts";

const appSource = readFileSync("src/App.tsx", "utf8");

test("all requested playground routes are registered", () => {
  assert.deepEqual(
    playgroundRoutes.map((route) => route.path),
    [
      "/maataa-ui/playground",
      "/maataa-ui/playground/components",
      "/maataa-ui/playground/themes",
      "/maataa-ui/playground/tokens",
      "/maataa-ui/playground/layouts",
      "/themelab/theme-sandbox",
      "/themelab/asset-sandbox",
      ...themeLabAssetReviewRoutes.map((route) => route.path),
      "/themelab/sandboxes",
    ],
  );
});

test("playground routes are PHKD-safe review surfaces", () => {
  for (const route of playgroundRoutes) {
    assert.equal(route.productionReady, false, `${route.path} must not claim production readiness`);
    assert.equal(route.runtimePromotion, false, `${route.path} must not promote runtime`);
    assert.equal(route.paymentMode, "NONE", `${route.path} must not expose payments`);
    assert.equal(route.dataMode, "LOCAL_STATIC_REVIEW", `${route.path} must stay local static review`);
    assert.match(route.evidence, /release\/evidence|release\/imports|packages\/maataa-ui|docs\/theme-lab-runtime|assets\/README/);
  }
});

test("blocked or unknown sections carry blocker reasons", () => {
  const sections = playgroundRoutes.flatMap((route) => route.sections.map((section) => ({ route: route.path, ...section })));
  const blocked = sections.filter((section) => section.status === "BLOCKED" || section.status === "UNKNOWN");
  assert.ok(blocked.length >= 5);
  for (const section of blocked) {
    assert.ok(section.blocker, `${section.route}/${section.id} is missing blocker reason`);
  }
});

test("App whitelists every playground route", () => {
  assert.match(appSource, /implementedPlaygroundRoutes/);
  assert.match(appSource, /<PlaygroundPage/);
});

test("unified search includes navigable playground routes", () => {
  const index = buildUnifiedSearchIndex();
  for (const route of playgroundRoutes) {
    const result = index.find((item) => item.id === `route:${route.path}`);
    assert.equal(result?.status, "PREVIEW_VERIFIED", `${route.path} missing from search index`);
    assert.equal(isNavigableSearchResult(result!), true, `${route.path} should be navigable`);
  }

  const themeLab = searchUnifiedIndex("themelab sandbox");
  assert.ok(themeLab.some((result) => result.path === "/themelab/sandboxes"));
});

test("ThemeLab asset sandbox import is preserved as source evidence, not live inventory", () => {
  const route = playgroundRoutes.find((item) => item.path === "/themelab/asset-sandbox");
  assert.equal(route?.evidence, themeLabAssetSandboxImport.sourcePath);
  assert.equal(existsSync(themeLabAssetSandboxImport.sourcePath), true);

  const source = readFileSync(themeLabAssetSandboxImport.sourcePath, "utf8");
  assert.match(source, /<title>ThemeLab Asset Sandbox<\/title>/);
  assert.match(source, /666 Asset Files/);
  assert.match(source, /No real payments/);
  assert.equal(themeLabAssetSandboxImport.productionReady, false);
  assert.equal(themeLabAssetSandboxImport.productionDatabase, false);
  assert.equal(themeLabAssetSandboxImport.realPayments, false);
  assert.equal(themeLabAssetSandboxImport.purchasedAccess, false);
  assert.equal(themeLabAssetSandboxImport.runtimePromotion, false);
  assert.equal(themeLabAssetSandboxImport.claimMode, "IMPORTED_SOURCE_CLAIMS_NOT_LIVE_METRICS");
  assert.ok(themeLabAssetSandboxImport.sourceClaims.every((claim) => claim.state === "SOURCE_CLAIM_ONLY"));
  assert.ok(route?.sections.some((section) => section.id === "source-counts" && section.status === "BLOCKED"));
  assert.ok(route?.sections.some((section) => section.id === "downloads" && section.status === "BLOCKED"));
});

test("ThemeLab asset review routes are concrete navigable review surfaces", () => {
  for (const reviewRoute of themeLabAssetReviewRoutes) {
    const route = playgroundRoutes.find((item) => item.path === reviewRoute.path);
    assert.equal(route?.title, reviewRoute.title);
    assert.equal(route?.status, "PREVIEW_VERIFIED");
    assert.equal(route?.productionReady, false);
    assert.equal(route?.runtimePromotion, false);
    assert.equal(route?.paymentMode, "NONE");
    assert.equal(route?.dataMode, "LOCAL_STATIC_REVIEW");
    assert.equal(route?.evidence, `${themeLabAssetSandboxImport.sourcePath}${reviewRoute.anchor}`);
    assert.ok(route?.sections.some((section) => section.id === "source-section" && section.status === "PREVIEW_VERIFIED"));
    assert.ok(route?.sections.some((section) => section.status === "BLOCKED" && section.blocker));

    const result = buildUnifiedSearchIndex().find((item) => item.id === `route:${reviewRoute.path}`);
    assert.equal(result?.status, "PREVIEW_VERIFIED");
    assert.equal(isNavigableSearchResult(result!), true);
  }
});

test("visual evidence report preserves no-go posture when present", () => {
  const reportPath = "release/evidence/maataa-ui-playground/report.json";
  if (!existsSync(reportPath)) {
    return;
  }
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  assert.equal(report.finalStatus, PLAYGROUND_FINAL_STATUS);
  assert.equal(report.productionStatus, PLAYGROUND_PRODUCTION_STATUS);
  assert.equal(report.productionReady, false);
  assert.equal(report.productionDatabase, false);
  assert.equal(report.realPayments, false);
  assert.equal(report.runtimePromotion, false);
  assert.equal(report.visualEvidence.engine, "playwright-core");
  assert.equal(report.visualEvidence.screenshots.length, playgroundRoutes.length);
  for (const screenshot of report.visualEvidence.screenshots) {
    assert.equal(existsSync(screenshot.file), true, `${screenshot.file} missing`);
  }
});
