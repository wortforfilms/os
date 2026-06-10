import assert from "node:assert/strict";
import { test } from "node:test";
import { researchAgentHealth, runResearchAgentCycle } from "../packages/research-agent/src/index.ts";

test("research agent discovers, analyzes, and validates a local KBS claim", () => {
  const result = runResearchAgentCycle({ query: "Brahmi" });

  assert.equal(result.isOk, true);
  if (!result.isOk) assert.fail(result.error.detail);

  assert.equal(result.data.agent, "maataa-research-agent");
  assert.equal(result.data.status, "LOCAL_PREVIEW");
  assert.equal(result.data.autonomy, "LOCAL_KBS_ONLY");
  assert.equal(result.data.externalDiscovery, false);
  assert.equal(result.data.productionReady, false);
  assert.equal(result.data.phkdVerdict, "BLOCKED");
  assert.ok(result.data.discovered.some((item) => item.id === "claim-brahmi-origin" && item.type === "claim"));
  assert.equal(result.data.analyzedClaim?.id, "claim-brahmi-origin");
  assert.equal(result.data.analyzedClaim?.status, "VERIFIED");
  assert.equal(result.data.analyzedClaim?.frozen, false);
  assert.equal(result.data.assessment?.status, "supported");
  assert.equal(result.data.assessment?.supportScore, 1);
  assert.equal(result.data.evidenceHashes.length, 1);
  assert.match(result.data.evidenceHashes[0], /^kbs:/);
});

test("research agent fails closed on empty or missing local queries", () => {
  const empty = runResearchAgentCycle({ query: " " });
  assert.equal(empty.isOk, false);
  assert.equal(empty.data.status, "BLOCKED");
  assert.equal(empty.data.productionReady, false);
  assert.equal(empty.data.externalDiscovery, false);
  assert.equal(empty.error?.code, "empty_query");

  const missing = runResearchAgentCycle({ query: "quantum crop yield telemetry" });
  assert.equal(missing.isOk, false);
  assert.equal(missing.data.status, "BLOCKED");
  assert.equal(missing.data.discovered.length, 0);
  assert.equal(missing.error?.code, "no_local_claim");
});

test("research agent marks frozen unsupported claims as blocked, not live truth", () => {
  const result = runResearchAgentCycle({ query: "Unverified historical date" });

  assert.equal(result.isOk, true);
  if (!result.isOk) assert.fail(result.error.detail);

  assert.equal(result.data.status, "LOCAL_PREVIEW");
  assert.equal(result.data.analyzedClaim?.id, "claim-unsourced-date");
  assert.equal(result.data.analyzedClaim?.status, "BLOCKED");
  assert.equal(result.data.analyzedClaim?.frozen, true);
  assert.equal(result.data.assessment?.status, "refuted");
  assert.equal(result.data.assessment?.against, 1);
  assert.equal(result.data.productionReady, false);
  assert.equal(result.data.phkdVerdict, "BLOCKED");
  assert.ok(result.data.blockers.some((blocker) => /citation lineage|source hash/i.test(blocker)));
});

test("research agent health is local preview only with explicit blockers", () => {
  const health = researchAgentHealth();

  assert.equal(health.status, "LOCAL_PREVIEW");
  assert.equal(health.externalDiscovery, false);
  assert.equal(health.productionReady, false);
  assert.equal(health.phkdVerdict, "BLOCKED");
  assert.ok(health.capabilities.includes("discover-local-kbs-records"));
  assert.ok(health.capabilities.includes("validate-with-advisory-support-score"));
  assert.ok(health.blockers.some((blocker) => /no web-scale/i.test(blocker)));
  assert.ok(health.blockers.some((blocker) => /no production trust/i.test(blocker)));
});

