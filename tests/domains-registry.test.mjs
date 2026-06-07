import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  domainSearchStatus,
  getGovernedDomainRegistry,
  hasDomainBlocker,
  isDomainRouteImplemented,
  summarizeDomainRegistry,
} from "../src/domains/index.ts";
import { buildUnifiedSearchIndex, isNavigableSearchResult, searchUnifiedIndex } from "../src/search/index.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(path) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

test("domain registry loads governed records", () => {
  const registry = getGovernedDomainRegistry();
  const summary = summarizeDomainRegistry(registry.domains);

  assert.equal(registry.schema, "maataa.domain-registry.v1");
  assert.equal(registry.finalStatus, "CONTROLLED_NO_GO");
  assert.equal(registry.productionReady, false);
  assert.equal(registry.phkdVerdict, "BLOCKED");
  assert.ok(registry.domains.length >= 5);
  assert.equal(summary.total, registry.domains.length);
  assert.ok(summary.dnsUnknown > 0);
});

test("unknown DNS does not show LIVE", () => {
  const registry = getGovernedDomainRegistry();
  const unknownDns = registry.domains.filter((domain) => domain.dnsState === "UNKNOWN");

  assert.ok(unknownDns.length > 0);
  assert.equal(registry.domains.some((domain) => domain.dnsState === "LIVE" || domain.runtimeState === "LIVE"), false);
  assert.equal(unknownDns.every((domain) => ["UNKNOWN", "BLOCKED"].includes(domainSearchStatus(domain))), true);
});

test("blocked domains show blocked reason", () => {
  const registry = getGovernedDomainRegistry();
  const blocked = registry.domains.filter((domain) => hasDomainBlocker(domain));

  assert.ok(blocked.length > 0);
  for (const domain of blocked) {
    assert.ok(domain.blocker.trim().length > 0, `${domain.domain} must explain its blocker`);
  }
});

test("domain routes render from App and component artifacts", () => {
  const registry = getGovernedDomainRegistry();
  const appSource = readFileSync(join(root, "src/App.tsx"), "utf8");
  const componentSource = readFileSync(join(root, "src/domains/DomainRegistryPage.tsx"), "utf8");

  assert.match(appSource, /"\/domains\/status"/);
  assert.match(appSource, /"\/domains\/runtime"/);
  assert.match(appSource, /<DomainRegistryPage/);
  assert.match(componentSource, /Domain registry table/);
  assert.match(componentSource, /ROUTE BLOCKED/);

  for (const route of registry.routes) {
    assert.equal(route.state, "PREVIEW_VERIFIED");
    assert.equal(existsSync(join(root, route.artifact)), true, `${route.artifact} must exist`);
    assert.equal(isDomainRouteImplemented(route.path), true);
  }
});

test("search index includes governed domains and blocks missing routes", () => {
  const index = buildUnifiedSearchIndex();
  const domainResults = searchUnifiedIndex("domains maataa", { type: "domain" }, index);
  const statusRoute = index.find((result) => result.id === "route:/domains/status");
  const blockedRadio = index.find((result) => result.id === "domain:dom-radio");

  assert.equal(domainResults.some((result) => result.title === "domains.maataa.local"), true);
  assert.equal(statusRoute?.status, "PREVIEW_VERIFIED");
  assert.equal(isNavigableSearchResult(statusRoute), true);
  assert.equal(blockedRadio?.status, "BLOCKED");
  assert.equal(isNavigableSearchResult(blockedRadio), false);
});

test("no production-ready claim is emitted", () => {
  const registry = readJson("data/domain-registry.json");
  const evidence = readJson("release/evidence/domain-registry.json");
  const serialized = JSON.stringify({ evidence, registry });

  assert.equal(registry.productionReady, false);
  assert.equal(evidence.productionReady, false);
  assert.equal(evidence.finalStatus, "CONTROLLED_NO_GO");
  assert.equal(evidence.phkdVerdict, "BLOCKED");
  assert.doesNotMatch(serialized, /"LIVE"/);
  assert.doesNotMatch(serialized, /"productionReady":true/);
});
