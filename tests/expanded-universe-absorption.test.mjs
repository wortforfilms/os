import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const hkd = JSON.parse(readFileSync("hkd/expanded-universe-absorption.hkd", "utf8"));

const requiredUniverses = [
  "Community & Society Universe",
  "Creator Economy Universe",
  "Media & Broadcasting Universe",
  "Communication Universe",
  "Commerce Universe",
  "Decision Intelligence Universe",
  "Wisdom Engine Universe",
  "Reasoning Universe",
  "Memory Evolution Universe",
  "Astronomy Universe",
  "Biology Universe",
  "Environmental Universe",
  "Energy Universe",
  "Security Universe",
  "Trust Universe",
  "Compliance Universe",
  "Space Exploration Universe",
  "Civilization Forecast Universe",
  "Future Technology Universe",
  "Maataa Consciousness Core Universe",
  "Maataa Avatar Universe",
  "Maataa Voice Universe",
  "Runtime Observatory Universe",
  "Consistency Universe"
];

test("expanded universe absorption preserves every requested universe name", () => {
  assert.deepEqual(hkd.extractedData.universes, requiredUniverses);
  assert.equal(hkd.sections.length, requiredUniverses.length);
  assert.equal(hkd.nodes.filter((node) => node.kind === "universe").length, requiredUniverses.length);
});

test("expanded universe absorption is explicitly prompt sourced", () => {
  assert.equal(hkd.sourceImage, "operator-prompt://2026-05-29/expanded-universe-list");
  assert.equal(hkd.extractedData.sourceMode, "operator_prompt_list");
  assert.equal(hkd.extractedData.sourceImagesFound, false);
  assert.equal(hkd.status, "vision");
});

test("missing image provenance blocks each universe without inventing implementation", () => {
  const sourceBlockers = hkd.claims.filter((claim) => claim.id.endsWith("-source-missing"));
  assert.equal(sourceBlockers.length, requiredUniverses.length);
  for (const claim of sourceBlockers) {
    assert.equal(claim.status, "BLOCKED");
    assert.match(claim.blockedReason, /no matching PNG was found/i);
  }
  assert.equal(hkd.claims.find((claim) => claim.id === "claim-batch-runtime-implementation-unverified")?.status, "UNVERIFIED");
});

test("every extracted section and node carries the prompt source reference", () => {
  const source = "operator-prompt://2026-05-29/expanded-universe-list";
  for (const section of hkd.sections) assert.equal(section.sourceImage, source, section.id);
  for (const node of hkd.nodes) assert.equal(node.sourceImage, source, node.id);
});

test("expanded universe claims use only PHKD-safe non-go states", () => {
  const allowed = new Set(["BLOCKED", "PARTIAL", "UNVERIFIED"]);
  for (const claim of hkd.claims) assert.equal(allowed.has(claim.status), true, claim.id);
});
