import test from "node:test";
import assert from "node:assert/strict";

import { endangeredScripts } from "../src/data/endangered-scripts.ts";
import { lipi426Master, LIPI_426_EXPECTED_COUNT } from "../src/data/lipi-426-master.ts";
import { summarizeScriptStatus } from "../src/registry/script-status.ts";

const ISO_15924 = /^[A-Z][a-z]{3}$/;

test("seeded endangered scripts exist and are non-trivial", () => {
  assert.ok(endangeredScripts.length > 0, "expected at least one endangered script");
});

test("summarizeScriptStatus() reports ENDANGERED equal to endangeredScripts.length and > 0", () => {
  const summary = summarizeScriptStatus();
  assert.equal(summary.ENDANGERED, endangeredScripts.length);
  assert.ok(summary.ENDANGERED > 0, "ENDANGERED count must be > 0");
});

test("every endangered record is honest source-claim, CONTROLLED_NO_GO, with provenance", () => {
  for (const script of endangeredScripts) {
    assert.equal(script.status, "ENDANGERED", `${script.id} status must be ENDANGERED`);
    assert.equal(
      script.reviewState,
      "CONTROLLED_NO_GO",
      `${script.id} reviewState must be CONTROLLED_NO_GO`,
    );
    assert.ok(
      Array.isArray(script.provenance) && script.provenance.length > 0,
      `${script.id} must carry a non-empty provenance array`,
    );
    for (const cite of script.provenance) {
      assert.ok(cite.sourceId, `${script.id} provenance entry needs a sourceId`);
      assert.ok(cite.url, `${script.id} provenance entry needs a url`);
      assert.ok(cite.note, `${script.id} provenance entry needs a note`);
    }
    assert.ok(
      script.isoCode === "UNKNOWN" || ISO_15924.test(script.isoCode),
      `${script.id} iso15924 must be Xxxx or UNKNOWN (got ${script.isoCode})`,
    );
    assert.ok(
      ["ENDANGERED", "EXTINCT", "DORMANT", "REVIVING"].includes(script.vitality),
      `${script.id} vitality must be a valid source-claim classification`,
    );
  }
});

test("master total stays exactly 426 and the invariant constant is unchanged", () => {
  assert.equal(lipi426Master.length, 426);
  assert.equal(LIPI_426_EXPECTED_COUNT, 426);
});

test("endangered records are present in the master with unique ids", () => {
  const masterIds = new Set(lipi426Master.map((script) => script.id));
  for (const script of endangeredScripts) {
    assert.ok(masterIds.has(script.id), `${script.id} must be wired into the master`);
  }
  const allIds = lipi426Master.map((script) => script.id);
  assert.equal(allIds.length, new Set(allIds).size, "master ids must be unique");
});

test("Kharosthi revival candidate does not mask the canonical historical Kharosthi record", () => {
  const canonical = lipi426Master.find((script) => script.id === "kharosthi");
  const candidate = lipi426Master.find((script) => script.id === "endangered-kharosthi");

  assert.ok(canonical, "canonical kharosthi record must remain present");
  assert.equal(canonical.status, "HISTORICAL");
  assert.ok(candidate, "source-claim endangered-kharosthi candidate must be present");
  assert.equal(candidate.status, "ENDANGERED");
  assert.equal(candidate.vitality, "EXTINCT");
  assert.equal(candidate.reviewState, "CONTROLLED_NO_GO");
});
