import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { playgroundRoutes, PLAYGROUND_FINAL_STATUS, PLAYGROUND_PRODUCTION_STATUS } from "../src/playgrounds/data.ts";
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
    assert.match(route.evidence, /release\/evidence|packages\/maataa-ui|docs\/theme-lab-runtime|assets\/README/);
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
