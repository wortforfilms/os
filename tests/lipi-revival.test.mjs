import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const def = JSON.parse(readFileSync("data/lipi-revival-definition.json", "utf8"));

test("operational definition declares both targets and the five revived criteria", () => {
  assert.equal(def.targets.revivedScripts, 50);
  assert.equal(def.targets.corpusTexts, 1000);
  const ids = def.revivedScriptCriteria.map((c) => c.id).sort();
  assert.deepEqual(ids, ["certified-review", "corpus-link", "second-source", "unicode-encoded", "verified-endonym"]);
  assert.ok(def.corpusTextSchema?.fields?.scriptId, "corpus text schema must exist");
});

test("progress evidence exists and is honestly NOT achieved", () => {
  assert.equal(existsSync("release/evidence/lipi-revival-progress.json"), true, "run scripts/generate-lipi-revival-progress.mjs first");
  const p = JSON.parse(readFileSync("release/evidence/lipi-revival-progress.json", "utf8"));
  assert.equal(p.achievement, "UNVERIFIED");
  assert.equal(p.governedProductionGo, false);
  assert.equal(p.reviewState, "CONTROLLED_NO_GO");
});

test("revived count is below target because nothing is CERTIFIED yet (fail closed)", () => {
  const p = JSON.parse(readFileSync("release/evidence/lipi-revival-progress.json", "utf8"));
  assert.ok(p.measured.revivedScripts < def.targets.revivedScripts);
  assert.equal(p.measured.perCriterion["certified-review"], 0, "no script may be CERTIFIED without real review");
  assert.ok(p.measured.certifiedCorpusTexts < def.targets.corpusTexts);
  assert.ok(p.blockers.length >= 1, "blockers must state the measured gap");
});
