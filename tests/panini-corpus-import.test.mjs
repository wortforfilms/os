import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("Panini import records real teaching examples but not the 3944 metadata stubs", () => {
  assert.equal(existsSync("data/lipi-corpus-texts.json"), true, "run scripts/import-panini-corpus-texts.mjs first");
  assert.equal(existsSync("release/evidence/panini-corpus-import.json"), true, "run scripts/import-panini-corpus-texts.mjs first");

  const corpus = JSON.parse(readFileSync("data/lipi-corpus-texts.json", "utf8"));
  const evidence = JSON.parse(readFileSync("release/evidence/panini-corpus-import.json", "utf8"));
  const panini = corpus.texts.filter((t) => t.id.startsWith("panini-ashtadhyayi-"));

  assert.equal(evidence.importedTextRecords, 15);
  assert.equal(evidence.declaredStubCandidates, 3944);
  assert.equal(evidence.notImportedStubCandidates, 3944);
  assert.equal(panini.length, 15);
  assert.equal(panini.some((t) => t.id.includes("stub")), false);
});

test("imported Panini texts are review-pending corpus candidates with hashes and provenance", () => {
  const corpus = JSON.parse(readFileSync("data/lipi-corpus-texts.json", "utf8"));
  const panini = corpus.texts.filter((t) => t.id.startsWith("panini-ashtadhyayi-"));
  assert.ok(panini.length > 0);

  for (const text of panini) {
    assert.equal(text.scriptId, "devanagari");
    assert.equal(text.language, "sa");
    assert.equal(text.reviewState, "CONTROLLED_NO_GO");
    assert.match(text.textHash, /^sha256:[a-f0-9]{64}$/);
    assert.ok(text.text.length > 0);
    assert.ok(text.provenance.some((p) => p.sourceId === "panini-ashtadhyayi-pdf-2015-22683"));
    assert.ok(text.provenance.some((p) => p.sourceId === "hemant-panini-teaching-complete"));
  }
});

test("Panini import does not certify corpus texts by volume", () => {
  const evidence = JSON.parse(readFileSync("release/evidence/panini-corpus-import.json", "utf8"));
  const corpus = JSON.parse(readFileSync("data/lipi-corpus-texts.json", "utf8"));
  const certified = corpus.texts.filter((t) => t.id.startsWith("panini-ashtadhyayi-") && t.reviewState === "CERTIFIED");

  assert.equal(evidence.certifiedTextRecords, 0);
  assert.equal(certified.length, 0);
  assert.equal(evidence.reviewState, "CONTROLLED_NO_GO");
  assert.equal(evidence.governedProductionGo, false);
});
