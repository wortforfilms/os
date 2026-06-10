import assert from "node:assert/strict";
import { test } from "node:test";
import { getLipiScriptById, listLipiScripts } from "../packages/lipi-runtime/src/registry/script-registry.ts";

test("Indus script is registered only as a blocked research label", () => {
  const indus = getLipiScriptById("indus");

  assert.ok(indus);
  assert.equal(indus.name, "Indus (Research)");
  assert.equal(indus.status, "BLOCKED");
  assert.equal(indus.direction, "MIXED");
  assert.match(indus.purpose ?? "", /Research-only/i);
  assert.match(indus.purpose ?? "", /not transliteration, OCR, or translation ready/i);
  assert.match(indus.oldestProof ?? "", /BLOCKED/i);
  assert.match(indus.oldestProof ?? "", /specialist review/i);
});

test("Indus research label preserves the 426-slot Lipi registry", () => {
  const scripts = listLipiScripts();
  const ids = new Set(scripts.map((script) => script.id));

  assert.equal(scripts.length, 426);
  assert.equal(ids.size, 426);
  assert.equal(ids.has("indus"), true);
});
